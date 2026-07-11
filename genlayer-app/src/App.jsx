import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Wallet, LogOut, CheckCircle, AlertTriangle, Activity, PlusCircle, PlayCircle } from 'lucide-react';
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

const ABI = parseAbi([
  "function mint(int256 amount)",
  "function create_market(string question)",
  "function bet(string market_id, bool is_yes, int256 amount)",
  "function resolve_market(string market_id, string resolution_url)",
  "function get_state() view returns (string)"
]);

function App() {
  const [contractAddress, setContractAddress] = useState('0xC1fc39F077B2311d2143369b127F682E457A582B');
  const [walletAddress, setWalletAddress] = useState('');
  const [isCorrectNetwork, setIsCorrectNetwork] = useState(true);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');

  const [protocolState, setProtocolState] = useState({
    balances: {},
    markets: {},
    next_market_id: 1
  });

  const [newMarketQuestion, setNewMarketQuestion] = useState('');
  const [betAmounts, setBetAmounts] = useState({});
  const [resolveUrls, setResolveUrls] = useState({});

  useEffect(() => {
    if (window.ethereum) {
      window.ethereum.request({ method: 'eth_chainId' }).then(checkNetwork);
      window.ethereum.on('chainChanged', checkNetwork);
      window.ethereum.on('accountsChanged', handleAccountsChanged);
    }
    
    let intervalId;
    if (contractAddress) {
      fetchState();
      intervalId = setInterval(fetchState, 5000);
    }
    
    return () => {
      if (window.ethereum) {
        window.ethereum.removeListener('chainChanged', checkNetwork);
        window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
      }
      if (intervalId) clearInterval(intervalId);
    }
  }, [contractAddress]);

  const fetchState = async () => {
    try {
      const publicClient = createClient({ 
        chain: studionet,
        provider: window.ethereum
      });
      const stateStr = await publicClient.readContract({ 
        address: contractAddress, 
        abi: ABI, 
        functionName: 'get_state' 
      });
      setProtocolState(JSON.parse(stateStr));
    } catch (err) {
      console.error("Failed to fetch state:", err);
    }
  };

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

  const switchNetwork = async () => {
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
          console.error('Failed to add network:', addError);
        }
      }
    }
  };

  const executeTransaction = async (functionName, args, loadingMessage, successMessage) => {
    if (!walletAddress || !isCorrectNetwork) {
      alert("Please connect your wallet to the correct network first.");
      return;
    }
    if (!contractAddress) {
      alert("Please set the contract address.");
      return;
    }

    setIsSubmitting(true);
    setStatusMessage(loadingMessage);

    try {
      const client = createClient({ 
        chain: studionet,
        provider: window.ethereum,
        account: walletAddress
      });
      const hash = await client.writeContract({
        address: contractAddress,
        abi: ABI,
        functionName: functionName,
        args: args,
      });

      setStatusMessage(`Transaction sent! Waiting for validators (Hash: ${hash.slice(0, 8)}...)`);
      
      const receipt = await client.waitForTransactionReceipt({ 
        hash,
        status: 'FINALIZED' 
      });
      
      console.log("Transaction Receipt:", receipt);

      // If it didn't throw, it was successful in GenLayer!
      setStatusMessage(`✅ ${successMessage}`);
      fetchState();
    } catch (err) {
      console.error(err);
      setStatusMessage(`❌ Error: ${err.message || 'Transaction failed'}`);
    } finally {
      setTimeout(() => setStatusMessage(''), 8000);
      setIsSubmitting(false);
    }
  };

  const handleMint = () => executeTransaction('mint', [5n], 'Requesting 5 Test GEN...', 'Successfully received 5 Test GEN!');
  const handleCreateMarket = () => executeTransaction('create_market', [newMarketQuestion], 'Creating market...', 'Market created successfully!');
  const handleBet = (marketId, isYes) => {
    const amt = parseInt(betAmounts[marketId] || "0");
    if (amt <= 0) return alert("Enter a valid amount");
    executeTransaction('bet', [marketId, isYes, BigInt(amt)], `Placing bet on ${isYes ? 'YES' : 'NO'}...`, 'Bet placed successfully!');
  };
  const handleResolve = (marketId) => {
    const url = resolveUrls[marketId];
    if (!url) return alert("Enter a valid news URL for resolution");
    executeTransaction('resolve_market', [marketId, url], 'Validators are resolving market using AI...', 'Market resolved successfully!');
  };

  const getBalance = () => {
    if (!walletAddress || !protocolState?.balances) return 0;
    const key = Object.keys(protocolState.balances).find(k => k.toLowerCase() === walletAddress.toLowerCase());
    return key ? protocolState.balances[key] : 0;
  };
  const myBalance = getBalance();
  const marketsList = Object.values(protocolState.markets).sort((a, b) => parseInt(b.id) - parseInt(a.id));

  return (
    <div className="app-container">
      <nav className="navbar">
        <div className="nav-brand">
          <div className="brand-icon">
            <Activity color="white" size={24} />
          </div>
          <div>
            <div className="brand-title">TruthStake</div>
            <div className="brand-subtitle">Decentralized Prediction Market</div>
          </div>
        </div>

        <div className="nav-controls">
          {contractAddress && walletAddress && (
            <div className="wallet-badge">
              <span style={{ color: '#a5b4fc' }}>{myBalance} GEN tokens</span>
              <button onClick={handleMint} disabled={isSubmitting} className="btn-mint">Request 5 GEN</button>
            </div>
          )}
          
          {!walletAddress ? (
            <button onClick={connectWallet} className="btn-primary">
              <Wallet size={18} /> Connect Wallet
            </button>
          ) : !isCorrectNetwork ? (
            <button onClick={switchNetwork} className="btn-primary" style={{ background: '#f43f5e', color: 'white' }}>
              <AlertTriangle size={18} /> Switch to StudioNet
            </button>
          ) : (
            <div className="wallet-badge" style={{ gap: '15px' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981', display: 'inline-block' }}></span>
                {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
              </span>
              <LogOut size={16} onClick={() => setWalletAddress('')} style={{ cursor: 'pointer', color: '#94a3b8' }} />
            </div>
          )}
        </div>
      </nav>

      <main className="main-content">
        <AnimatePresence>
          {statusMessage && (
            <motion.div
              initial={{ opacity: 0, y: -20, x: 20 }}
              animate={{ opacity: 1, y: 0, x: 0 }}
              exit={{ opacity: 0, y: -20, x: 20 }}
              className="toast"
            >
              {!statusMessage.includes('✅') && !statusMessage.includes('❌') && <div className="spinner" />}
              <span>{statusMessage}</span>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="sidebar">
          <div className="glass-panel">
            <div className="panel-header">
              <PlusCircle size={20} color="#a855f7" /> Create New Market
            </div>
            <div className="panel-desc">Ask a question about a verifiable real-world event.</div>
            <textarea
              placeholder="e.g. Will SpaceX successfully launch Starship before Friday?"
              value={newMarketQuestion}
              onChange={(e) => setNewMarketQuestion(e.target.value)}
              className="input-field"
            />
            <button
              onClick={handleCreateMarket}
              disabled={isSubmitting || !newMarketQuestion}
              className="btn-action"
            >
              Deploy Market
            </button>
          </div>
        </div>

        <div className="markets-container">
          <div className="section-title">
            <PlayCircle color="#6366f1" size={28} /> Active Markets
          </div>
          
          {!contractAddress ? (
            <div className="empty-state">Please set the contract address to load markets.</div>
          ) : marketsList.length === 0 ? (
            <div className="empty-state">No markets found. Create one to get started!</div>
          ) : (
            marketsList.map((market) => {
              const totalPool = parseInt(market.total_yes) + parseInt(market.total_no);
              const yesPercent = totalPool > 0 ? Math.round((parseInt(market.total_yes) / totalPool) * 100) : 50;
              
              return (
                <div key={market.id} className="market-card">
                  <div className="market-header">
                    <div className="market-question">{market.question}</div>
                    <div className={`status-badge ${market.status === 'OPEN' ? 'status-live' : 'status-resolved'}`}>
                      {market.status}
                    </div>
                  </div>

                  <div className="progress-section">
                    <div className="progress-labels">
                      <span className="text-yes">Yes {yesPercent}%</span>
                      <span className="text-pool">Total Pool: {totalPool} GEN</span>
                      <span className="text-no">No {100 - yesPercent}%</span>
                    </div>
                    <div className="progress-bar-container">
                      <div className="progress-yes" style={{ width: `${yesPercent}%` }} />
                      <div className="progress-no" style={{ width: `${100 - yesPercent}%` }} />
                    </div>
                  </div>

                  {market.status === 'OPEN' ? (
                    <div>
                      <div className="betting-controls">
                        <input
                          type="number"
                          placeholder="Amount (GEN)"
                          value={betAmounts[market.id] || ''}
                          onChange={(e) => setBetAmounts({...betAmounts, [market.id]: e.target.value})}
                          className="bet-input"
                        />
                        <button onClick={() => handleBet(market.id, true)} disabled={isSubmitting} className="btn-bet-yes">Bet YES</button>
                        <button onClick={() => handleBet(market.id, false)} disabled={isSubmitting} className="btn-bet-no">Bet NO</button>
                      </div>

                      <div className="resolution-section">
                        <span className="resolution-label">Resolve Market</span>
                        <div className="resolve-controls">
                          <input
                            type="text"
                            placeholder="News URL (e.g. https://reuters.com/...)"
                            value={resolveUrls[market.id] || ''}
                            onChange={(e) => setResolveUrls({...resolveUrls, [market.id]: e.target.value})}
                            className="input-field"
                            style={{ marginBottom: 0 }}
                          />
                          <button onClick={() => handleResolve(market.id)} disabled={isSubmitting} className="btn-resolve">Resolve</button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="resolved-result">
                      <div>
                        <div style={{ fontSize: '0.9rem', color: '#94a3b8', marginBottom: '5px' }}>Final Result</div>
                        <div className={`result-answer result-${market.resolved_answer}`}>
                          {market.resolved_answer}
                        </div>
                      </div>
                      <CheckCircle size={36} className={`result-${market.resolved_answer}`} style={{ opacity: 0.5 }} />
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </main>
    </div>
  );
}

export default App;
