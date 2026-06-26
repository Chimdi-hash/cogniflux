import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, Orbit, Wallet, AlertTriangle, LogOut } from 'lucide-react';
import { createClient } from 'genlayer-js';
import { parseAbi, parseEther } from 'viem';
import './index.css';

// Using a custom chain config since we know the exact RPC for Studio
const studioChain = {
  id: 61999,
  name: 'GenLayer Studio Network',
  nativeCurrency: { name: 'GEN', symbol: 'GEN', decimals: 18 },
  rpcUrls: { default: { http: ['https://studio.genlayer.com/api'] } },
};

const GENLAYER_NETWORK_CONFIG = {
  chainId: `0x${studioChain.id.toString(16)}`,
  chainName: studioChain.name,
  nativeCurrency: studioChain.nativeCurrency,
  rpcUrls: studioChain.rpcUrls.default.http,
  blockExplorerUrls: null
};

// Use viem's parseAbi for type-safe ABI encoding required by genlayer-js
const ABI = parseAbi([
  "function submit_idea(string idea) payable",
  "function get_latest_remark() view returns (string)"
]);

function App() {
  const [idea, setIdea] = useState('');
  const [contractAddress] = useState('0x48fF68CBEA04C3d753695DB8520B7f6bba6eb095');
  const [walletAddress, setWalletAddress] = useState('');
  const [isCorrectNetwork, setIsCorrectNetwork] = useState(true);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [remark, setRemark] = useState('');

  // Check network on load and account change
  useEffect(() => {
    if (window.ethereum) {
      window.ethereum.request({ method: 'eth_chainId' }).then(checkNetwork);
      window.ethereum.on('chainChanged', checkNetwork);
      window.ethereum.on('accountsChanged', handleAccountsChanged);
    }
    return () => {
      if (window.ethereum) {
        window.ethereum.removeListener('chainChanged', checkNetwork);
        window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
      }
    }
  }, []);

  const checkNetwork = (chainId) => {
    setIsCorrectNetwork(parseInt(chainId, 16) === studioChain.id);
  };

  const handleAccountsChanged = (accounts) => {
    if (accounts.length > 0) {
      setWalletAddress(accounts[0]);
    } else {
      setWalletAddress('');
    }
  };

  const connectWallet = async () => {
    if (!window.ethereum) {
      alert("Please install MetaMask or another Web3 wallet.");
      return;
    }
    try {
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      setWalletAddress(accounts[0]);
      const chainId = await window.ethereum.request({ method: 'eth_chainId' });
      checkNetwork(chainId);
    } catch (err) {
      console.error("Wallet connection failed:", err);
    }
  };

  const disconnectWallet = () => {
    setWalletAddress('');
    setRemark('');
  };

  const switchToGenLayer = async () => {
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: GENLAYER_NETWORK_CONFIG.chainId }],
      });
    } catch (switchError) {
      if (switchError.code === 4902) {
        try {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [GENLAYER_NETWORK_CONFIG],
          });
        } catch (addError) {
          console.error("Failed to add GenLayer network:", addError);
        }
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!idea.trim()) return;
    
    if (!walletAddress) {
      alert("Please connect your wallet first.");
      return;
    }

    if (!isCorrectNetwork) {
      await switchToGenLayer();
      return;
    }

    setIsSubmitting(true);
    setRemark('');
    setStatusMessage('Awaiting wallet approval (1 GEN)...');

    try {
      // Initialize the GenLayer SDK client for writing transactions
      const writeClient = createClient({
        chain: studioChain,
        account: walletAddress,
        provider: window.ethereum,
      });
      
      // 1. Send Transaction (Calls submit_idea on the GenLayer Contract)
      const txHash = await writeClient.writeContract({
        address: contractAddress,
        abi: ABI,
        functionName: 'submit_idea',
        args: [idea],
        value: parseEther("1.0") // 1 GEN in wei
      });

      // 2. Wait for Consensus
      setStatusMessage('5 validators are running judgement............');
      await writeClient.waitForTransactionReceipt({ 
        hash: txHash,
        status: 'FINALIZED' // Wait for the AI consensus to reach finality
      });

      // 3. Fetch Actual Result
      setStatusMessage('Fetching consensus result...');
      
      const remarkResult = await writeClient.readContract({
        address: contractAddress,
        abi: ABI,
        functionName: 'get_latest_remark',
      });
      
      setRemark(remarkResult);
      
    } catch (err) {
      console.error(err);
      alert("Transaction failed or was rejected. See console for details.");
    } finally {
      setIsSubmitting(false);
      setStatusMessage('');
    }
  };

  return (
    <div className="app-container">
      <motion.header
        initial={{ opacity: 0, y: -50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
      >
        <div className="wallet-header-controls">
          {!walletAddress ? (
            <button onClick={connectWallet} className="btn-wallet">
              <Wallet size={16} /> Connect Wallet
            </button>
          ) : (
            <div className="wallet-info">
              <span className="wallet-pill">{walletAddress.slice(0,6)}...{walletAddress.slice(-4)}</span>
              {!isCorrectNetwork && (
                <button onClick={switchToGenLayer} className="btn-warning">
                  <AlertTriangle size={14} /> Switch Network
                </button>
              )}
              <button onClick={disconnectWallet} className="btn-wallet disconnect-btn" title="Disconnect">
                <LogOut size={14} />
              </button>
            </div>
          )}
        </div>

        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          style={{ display: 'inline-block', marginBottom: '1rem', marginTop: '2rem' }}
        >
          <Orbit size={48} color="var(--neon-cyan)" />
        </motion.div>
        <h1>GenLayer Nexus</h1>
        <p className="subtitle">Intelligent Contract Idea Evaluator</p>
      </motion.header>

      <motion.div 
        className="network-status"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5, duration: 1 }}
      >
        <div className="status-dot"></div>
        <span>Connected to GenLayer Studio Network</span>
      </motion.div>

      <motion.div 
        className="glass-panel"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.2, duration: 0.6 }}
      >
        <form onSubmit={handleSubmit}>
          <div className="input-group">
            <label htmlFor="idea">Input Web3 Project Idea</label>
            <textarea
              id="idea"
              placeholder="e.g., A decentralized exchange where liquidity is managed by autonomous AI agents..."
              value={idea}
              onChange={(e) => setIdea(e.target.value)}
              disabled={isSubmitting}
            />
          </div>
          
          <button type="submit" className="btn-primary" disabled={isSubmitting || !idea.trim()}>
            {isSubmitting ? (
              <>
                <div className="loader"></div>
                Processing...
              </>
            ) : (
              <>
                <Zap size={20} />
                Pay 1 GEN & Evaluate
              </>
            )}
          </button>
        </form>

        {isSubmitting && statusMessage && (
          <div className={statusMessage.includes('judgement') ? 'blinking-text' : 'status-text'}>
            {statusMessage}
          </div>
        )}

        <AnimatePresence>
          {remark && !isSubmitting && (
            <motion.div 
              className="result-container"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.5 }}
            >
              <label>Consensus Reached (Actual Result from Contract)</label>
              <motion.div 
                className="result-box"
                initial={{ x: -20 }}
                animate={{ x: 0 }}
                transition={{ type: "spring", stiffness: 100 }}
              >
                {remark}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      <motion.div 
        className="glass-panel"
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.6 }}
      >
        <h2 style={{ marginBottom: '1.5rem', color: 'var(--neon-purple)', fontSize: '1.5rem' }}>
          How it Works (GenLayer)
        </h2>
        <div className="steps-container">
          <div className="step">
            <div className="step-number">1</div>
            <div className="step-content">
              <h3>Connect & Pay</h3>
              <p>Your wallet connects to GenLayer and sends exactly 1 GEN token to trigger the `submit_idea` payable method.</p>
            </div>
          </div>
          <div className="step">
            <div className="step-number">2</div>
            <div className="step-content">
              <h3>LLM Processing</h3>
              <p>The contract executes a non-deterministic block using `gl.eq_principle.prompt_non_comparative`.</p>
            </div>
          </div>
          <div className="step">
            <div className="step-number">3</div>
            <div className="step-content">
              <h3>Validator Consensus</h3>
              <p>5 independent validators evaluate the LLM's cyberpunk remark against strict formatting criteria.</p>
            </div>
          </div>
          <div className="step">
            <div className="step-number">4</div>
            <div className="step-content">
              <h3>State Update</h3>
              <p>Consensus is reached, the transaction finalizes, and the futuristic output is recorded on-chain.</p>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

export default App;
