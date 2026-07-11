import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, Orbit, Wallet, AlertTriangle, LogOut } from 'lucide-react';
import { createClient } from 'genlayer-js';
import { studionet } from 'genlayer-js/chains';
import { parseAbi } from 'viem';
import './index.css';

const GENLAYER_NETWORK_CONFIG = {
  chainId: `0x${studionet.id.toString(16)}`,
  chainName: studionet.name,
  nativeCurrency: studionet.nativeCurrency,
  rpcUrls: studionet.rpcUrls.default.http,
  blockExplorerUrls: null
};

// Use viem's parseAbi for type-safe ABI encoding required by genlayer-js
const ABI = parseAbi([
  "function analyze_sentiment(string token, string source_url)",
  "function get_latest_sentiment() view returns (string)",
  "function get_latest_rationale() view returns (string)"
]);

function App() {
  const [tokenSymbol, setTokenSymbol] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [contractAddress] = useState('0x42fEDB0208A7942eF2Cf7a1FC11456469943afF6');
  const [walletAddress, setWalletAddress] = useState('');
  const [isCorrectNetwork, setIsCorrectNetwork] = useState(true);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sentiment, setSentiment] = useState('');
  const [rationale, setRationale] = useState('');
  const [statusMessage, setStatusMessage] = useState('');

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
    setIsCorrectNetwork(parseInt(chainId, 16) === studionet.id);
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
    setSentiment('');
    setRationale('');
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
    if (!tokenSymbol.trim() || !sourceUrl.trim()) return;
    
    if (!walletAddress) {
      alert("Please connect your wallet first.");
      return;
    }

    if (!isCorrectNetwork) {
      await switchToGenLayer();
      return;
    }

    setIsSubmitting(true);
    setSentiment('');
    setRationale('');
    setStatusMessage('Awaiting wallet approval...');

    try {
      // Initialize the GenLayer SDK client for writing transactions
      const writeClient = createClient({
        chain: studionet,
        account: walletAddress,
        provider: window.ethereum,
      });
      
      // 1. Send Transaction (Calls analyze_sentiment on the GenLayer Contract)
      const txHash = await writeClient.writeContract({
        address: contractAddress,
        abi: ABI,
        functionName: 'analyze_sentiment',
        args: [tokenSymbol, sourceUrl],
        value: 0n,
        gas: 30000000n // Bypass viem gas estimation for non-deterministic chains
      });

      // 2. Wait for Consensus
      setStatusMessage('5 validators are running judgement............');
      await writeClient.waitForTransactionReceipt({ 
        hash: txHash,
        status: 'FINALIZED',
        interval: 5000,
        retries: 60
      });

      // 3. Fetch Actual Result
      setStatusMessage('Fetching final sentiment consensus...');
      const publicClient = createClient({ chain: studionet });
      
      const newSentiment = await publicClient.readContract({
        address: contractAddress,
        abi: ABI,
        functionName: 'get_latest_sentiment'
      });

      const newRationale = await publicClient.readContract({
        address: contractAddress,
        abi: ABI,
        functionName: 'get_latest_rationale'
      });

      setSentiment(newSentiment);
      setRationale(newRationale);
      setStatusMessage('');
      
    } catch (err) {
      console.error(err);
      alert("Transaction failed or was rejected. See console for details.");
      setStatusMessage('');
    } finally {
      setIsSubmitting(false);
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
        <h1>CogniFlux</h1>
        <p className="subtitle">Decentralized DAO Sentiment Oracle</p>
      </motion.header>

      <motion.div 
        className="network-status"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5, duration: 1 }}
      >
        <div className="status-dot"></div>
        <span>built on GenLayer Studio Network</span>
      </motion.div>

      <motion.div 
        className="glass-panel"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.2, duration: 0.6 }}
      >
        <form onSubmit={handleSubmit}>
          <div className="input-group">
            <input 
              type="text" 
              placeholder="Token Symbol (e.g. Ethereum)" 
              value={tokenSymbol}
              onChange={(e) => setTokenSymbol(e.target.value)}
              disabled={isSubmitting}
              className="cyber-input"
            />
          </div>
          <div className="input-group">
            <input 
              type="url" 
              placeholder="Source URL (e.g. news article, reddit post)" 
              value={sourceUrl}
              onChange={(e) => setSourceUrl(e.target.value)}
              disabled={isSubmitting}
              className="cyber-input"
            />
          </div>
          
          <button type="submit" className="btn-primary" disabled={isSubmitting || !tokenSymbol.trim() || !sourceUrl.trim()}>
            {isSubmitting ? (
              <>
                <div className="loader"></div>
                Analyzing...
              </>
            ) : (
              <>
                <Zap size={20} />
                ANALYZE SENTIMENT
              </>
            )}
          </button>
        </form>

        <AnimatePresence>
          {statusMessage && (
            <motion.div 
              className="status-message blinking-text"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
            >
              {statusMessage}
            </motion.div>
          )}

          {sentiment && (
            <motion.div 
              className="result-container"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: "spring", bounce: 0.5 }}
            >
              <h3>Consensus Reached</h3>
              <div className={`sentiment-badge ${sentiment.toLowerCase()}`}>
                {sentiment}
              </div>
              <div className="cyber-remark">
                <p>{rationale}</p>
              </div>
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
              <h3>Connect & Submit</h3>
              <p>Your wallet connects to GenLayer. Submit a Token and a Source URL to trigger the `analyze_sentiment` method.</p>
            </div>
          </div>
          <div className="step">
            <div className="step-number">2</div>
            <div className="step-content">
              <h3>Intelligent Verification</h3>
              <p>GenLayer's validators fetch the URL's contents from the web and use AI to analyze the token's sentiment.</p>
            </div>
          </div>
          <div className="step">
            <div className="step-number">3</div>
            <div className="step-content">
              <h3>Consensus</h3>
              <p>Once validators agree, the final sentiment (BULLISH/BEARISH) is locked on-chain as a verified Oracle update.</p>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

export default App;
