import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, Orbit, Wallet, AlertTriangle, LogOut, CheckCircle, XCircle } from 'lucide-react';
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
  "function create_job(string description)",
  "function submit_work(string source_url)",
  "function get_job_description() view returns (string)",
  "function get_status() view returns (string)",
  "function get_freelancer_url() view returns (string)"
]);

function App() {
  const [contractAddress, setContractAddress] = useState(''); // User will provide this
  const [sourceUrl, setSourceUrl] = useState('');
  
  const [walletAddress, setWalletAddress] = useState('');
  const [isCorrectNetwork, setIsCorrectNetwork] = useState(true);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingEscrow, setIsLoadingEscrow] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');

  // Escrow State
  const [jobDescription, setJobDescription] = useState('');
  const [escrowStatus, setEscrowStatus] = useState('');
  const [submittedUrl, setSubmittedUrl] = useState('');

  // Check network on load and account change
  useEffect(() => {
    if (window.ethereum) {
      window.ethereum.request({ method: 'eth_chainId' }).then(checkNetwork);
      window.ethereum.on('chainChanged', checkNetwork);
      window.ethereum.on('accountsChanged', handleAccountsChanged);
    }
    
    // Auto-load escrow when component mounts if address exists
    if (contractAddress) {
      loadEscrow();
    }
    
    return () => {
      if (window.ethereum) {
        window.ethereum.removeListener('chainChanged', checkNetwork);
        window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
      }
    }
  }, [contractAddress]);

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
    setJobDescription('');
    setEscrowStatus('');
    setSubmittedUrl('');
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

  const loadEscrow = async () => {
    if (!contractAddress.trim()) return;
    setIsLoadingEscrow(true);
    setJobDescription('');
    setEscrowStatus('');
    setSubmittedUrl('');
    
    try {
      const publicClient = createClient({ chain: studionet });
      
      const description = await publicClient.readContract({
        address: contractAddress,
        abi: ABI,
        functionName: 'get_job_description'
      });
      const status = await publicClient.readContract({
        address: contractAddress,
        abi: ABI,
        functionName: 'get_status'
      });
      const url = await publicClient.readContract({
        address: contractAddress,
        abi: ABI,
        functionName: 'get_freelancer_url'
      });

      setJobDescription(description);
      setEscrowStatus(status);
      setSubmittedUrl(url);
    } catch (err) {
      console.error(err);
      alert("Failed to load escrow. Please ensure the contract address is correct.");
    } finally {
      setIsLoadingEscrow(false);
    }
  };

  const handleCreateJob = async (e) => {
    e.preventDefault();
    if (!jobDescription.trim() || !contractAddress.trim()) return;
    
    if (!walletAddress) {
      alert("Please connect your wallet first.");
      return;
    }

    if (!isCorrectNetwork) {
      await switchToGenLayer();
      return;
    }

    setIsSubmitting(true);
    setStatusMessage('Awaiting wallet approval...');

    try {
      const writeClient = createClient({
        chain: studionet,
        account: walletAddress,
        provider: window.ethereum,
      });
      
      const txHash = await writeClient.writeContract({
        address: contractAddress,
        abi: ABI,
        functionName: 'create_job',
        args: [jobDescription],
        value: 0n,
        gas: 30000000n
      });

      setStatusMessage('Initializing escrow...');
      await writeClient.waitForTransactionReceipt({ 
        hash: txHash,
        status: 'FINALIZED',
        interval: 5000,
        retries: 60
      });

      setStatusMessage('Escrow created!');
      await loadEscrow();
      setStatusMessage('');
      
    } catch (err) {
      console.error(err);
      alert("Transaction failed or was rejected. See console for details.");
      setStatusMessage('');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitWork = async (e) => {
    e.preventDefault();
    if (!sourceUrl.trim() || !contractAddress.trim()) return;
    
    if (!walletAddress) {
      alert("Please connect your wallet first.");
      return;
    }

    if (!isCorrectNetwork) {
      await switchToGenLayer();
      return;
    }

    setIsSubmitting(true);
    setStatusMessage('Awaiting wallet approval...');

    try {
      // Initialize the GenLayer SDK client for writing transactions
      const writeClient = createClient({
        chain: studionet,
        account: walletAddress,
        provider: window.ethereum,
      });
      
      // 1. Send Transaction
      const txHash = await writeClient.writeContract({
        address: contractAddress,
        abi: ABI,
        functionName: 'submit_work',
        args: [sourceUrl],
        value: 0n,
        gas: 30000000n // Bypass viem gas estimation for non-deterministic chains
      });

      // 2. Wait for Consensus
      setStatusMessage('5 validators are reviewing your work via LLM...');
      await writeClient.waitForTransactionReceipt({ 
        hash: txHash,
        status: 'FINALIZED',
        interval: 5000,
        retries: 60
      });

      // 3. Fetch Actual Result
      setStatusMessage('Fetching final consensus state...');
      await loadEscrow();
      
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
        <h1>Smart Escrow</h1>
        <p className="subtitle">AI-Powered Freelance Escrow Protocol</p>
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
        <div className="escrow-loader">
          {contractAddress ? (
            <p><strong>Contract Loaded:</strong> {contractAddress}</p>
          ) : (
            <p className="text-secondary">Awaiting Escrow Deployment...</p>
          )}
        </div>

        {escrowStatus === 'UNINITIALIZED' && (
          <motion.div 
            className="escrow-details"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="escrow-header">
              <h3>Initialize Escrow</h3>
            </div>
            
            <form onSubmit={handleCreateJob}>
              <div className="input-group">
                <input 
                  type="text" 
                  placeholder="Job Description (e.g. Write an article about AI)" 
                  value={jobDescription}
                  onChange={(e) => setJobDescription(e.target.value)}
                  disabled={isSubmitting}
                  className="cyber-input"
                />
              </div>
              
              <button type="submit" className="btn-primary" disabled={isSubmitting || !jobDescription.trim()}>
                {isSubmitting ? (
                  <>
                    <div className="loader"></div>
                    Initializing...
                  </>
                ) : (
                  <>
                    <Zap size={20} />
                    CREATE ESCROW
                  </>
                )}
              </button>
            </form>
          </motion.div>
        )}

        {(escrowStatus && escrowStatus !== 'UNINITIALIZED') && (
          <motion.div 
            className="escrow-details"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="escrow-header">
              <h3>Escrow Details</h3>
              <div className={`status-badge ${escrowStatus.toLowerCase()}`}>
                {escrowStatus === 'RELEASED' && <CheckCircle size={16} />}
                {escrowStatus === 'REJECTED' && <XCircle size={16} />}
                {escrowStatus}
              </div>
            </div>
            
            <div className="cyber-remark">
              <label>Job Description</label>
              <p>{jobDescription}</p>
            </div>

            {submittedUrl && (
              <div className="cyber-remark">
                <label>Latest Submission</label>
                <a href={submittedUrl} target="_blank" rel="noopener noreferrer">{submittedUrl}</a>
              </div>
            )}

            {escrowStatus !== 'RELEASED' && (
              <form onSubmit={handleSubmitWork} style={{ marginTop: '2rem' }}>
                <div className="input-group">
                  <input 
                    type="url" 
                    placeholder="Source URL (e.g. GitHub PR, Article Link)" 
                    value={sourceUrl}
                    onChange={(e) => setSourceUrl(e.target.value)}
                    disabled={isSubmitting}
                    className="cyber-input"
                  />
                </div>
                
                <button type="submit" className="btn-primary" disabled={isSubmitting || !sourceUrl.trim()}>
                  {isSubmitting ? (
                    <>
                      <div className="loader"></div>
                      Evaluating...
                    </>
                  ) : (
                    <>
                      <Zap size={20} />
                      SUBMIT WORK FOR AI EVALUATION
                    </>
                  )}
                </button>
              </form>
            )}
          </motion.div>
        )}

        <AnimatePresence>
          {statusMessage && (
            <motion.div 
              className="status-message blinking-text"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              style={{ marginTop: '1.5rem' }}
            >
              {statusMessage}
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
          How it Works
        </h2>
        <div className="steps-container">
          <div className="step">
            <div className="step-number">1</div>
            <div className="step-content">
              <h3>Deploy Escrow</h3>
              <p>The client creates an escrow contract instantiated with a specific job description and funds it.</p>
            </div>
          </div>
          <div className="step">
            <div className="step-number">2</div>
            <div className="step-content">
              <h3>Submit & Evaluate</h3>
              <p>The freelancer submits a URL of their work. GenLayer validators independently fetch the work and use AI to check if it matches the job description.</p>
            </div>
          </div>
          <div className="step">
            <div className="step-number">3</div>
            <div className="step-content">
              <h3>Consensus & Payout</h3>
              <p>If validators reach consensus that the work is satisfactory, the contract state becomes RELEASED and funds are unlocked.</p>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

export default App;
