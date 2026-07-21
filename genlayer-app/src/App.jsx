import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Wallet, LogOut, CheckCircle, AlertTriangle, Activity, PlusCircle, PlayCircle, User, PieChart, TrendingUp, Award } from 'lucide-react';
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
  "function create_market(string question)",
  "function bet(string market_id, bool is_yes) payable",
  "function resolve_market(string market_id, string resolution_url)",
  "function claim_reward(string market_id)",
  "function get_state() view returns (string)"
]);

function App() {
  const [contractAddress, setContractAddress] = useState('0xEA0cD7116991407Cfb62DaB25fA4C9bC29295330');
  const [walletAddress, setWalletAddress] = useState('');
  const [walletBalance, setWalletBalance] = useState('0');
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
  const [activeTab, setActiveTab] = useState('ALL');
  const [showDashboard, setShowDashboard] = useState(false);

  useEffect(() => {
    if (window.ethereum) {
      window.ethereum.request({ method: 'eth_chainId' }).then(checkNetwork);
      window.ethereum.on('chainChanged', checkNetwork);
      window.ethereum.on('accountsChanged', handleAccountsChanged);
    }
    
    let intervalId;
    if (contractAddress) {
      fetchState();
      intervalId = setInterval(async () => {
        fetchState();
        if (window.ethereum) {
          try {
            const accounts = await window.ethereum.request({ method: 'eth_accounts' });
            if (accounts && accounts.length > 0) {
              const hexBalance = await window.ethereum.request({ method: 'eth_getBalance', params: [accounts[0], 'latest'] });
              setWalletBalance((parseInt(hexBalance, 16) / 10**18).toFixed(2));
            }
          } catch(e) {}
        }
      }, 5000);
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
      window.ethereum.request({ 
        method: 'eth_getBalance', 
        params: [accounts[0], 'latest'] 
      }).then(hexBalance => {
        setWalletBalance((parseInt(hexBalance, 16) / 10**18).toFixed(2));
      }).catch(console.error);
    } else {
      setWalletAddress('');
      setWalletBalance('0');
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

  const executeTransaction = async (functionName, args, loadingMessage, successMessage, value = undefined) => {
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
        value: value,
      });

      setStatusMessage(`Transaction sent! Waiting for validators (Hash: ${hash.slice(0, 8)}...)`);
      
      const receipt = await client.waitForTransactionReceipt({ 
        hash
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

  const handleCreateMarket = () => executeTransaction('create_market', [newMarketQuestion], 'Creating market...', 'Market created successfully!');
  const handleBet = (marketId, isYes) => {
    const amt = parseInt(betAmounts[marketId] || "0");
    if (amt <= 0) return alert("Enter a valid amount");
    executeTransaction('bet', [marketId, isYes], `Placing bet on ${isYes ? 'YES' : 'NO'}...`, 'Bet placed successfully!', BigInt(amt) * 10n**18n);
  };
  const handleResolve = (marketId) => {
    const url = resolveUrls[marketId];
    if (!url) return alert("Enter a valid news URL for resolution");
    executeTransaction('resolve_market', [marketId, url], 'Validators are resolving market using AI...', 'Market resolved successfully!');
  };


  const allMarkets = Object.values(protocolState?.markets || {}).sort((a, b) => parseInt(b.id) - parseInt(a.id));
  
  const marketsList = allMarkets.filter(market => {
    if (activeTab === 'ALL') return true;
    if (activeTab === 'OPEN') return market.status === 'OPEN';
    if (activeTab === 'RESOLVED') return market.status === 'RESOLVED';
    return true;
  });
  
  const totalTVL = Object.values(protocolState?.markets || {}).reduce((acc, market) => {
    return acc + parseInt(market.total_yes || 0) + parseInt(market.total_no || 0);
  }, 0);
  
  const maxPool = Math.max(...allMarkets.filter(m => m.status === 'OPEN').map(m => parseInt(m.total_yes || 0) + parseInt(m.total_no || 0)), 0);

  // Compute dashboard metrics
  const userAddress = walletAddress?.toLowerCase() || '';
  const myBets = allMarkets.filter(m => {
    return Object.keys(m.yes_bets || {}).some(k => k.toLowerCase() === userAddress) ||
           Object.keys(m.no_bets || {}).some(k => k.toLowerCase() === userAddress);
  });
  
  const totalWagered = myBets.reduce((acc, m) => {
    const yesBet = Object.entries(m.yes_bets || {}).find(([k]) => k.toLowerCase() === userAddress);
    const noBet = Object.entries(m.no_bets || {}).find(([k]) => k.toLowerCase() === userAddress);
    return acc + (yesBet ? parseInt(yesBet[1]) : 0) + (noBet ? parseInt(noBet[1]) : 0);
  }, 0);
  
  const marketsResolved = myBets.filter(m => m.status === 'RESOLVED' && m.resolved_answer !== 'INVALID');
  const wonMarkets = marketsResolved.filter(m => {
    if (m.resolved_answer === 'YES' && Object.keys(m.yes_bets || {}).some(k => k.toLowerCase() === userAddress)) return true;
    if (m.resolved_answer === 'NO' && Object.keys(m.no_bets || {}).some(k => k.toLowerCase() === userAddress)) return true;
    return false;
  });
  const winRate = marketsResolved.length > 0 ? Math.round((wonMarkets.length / marketsResolved.length) * 100) : 0;
  
  const totalWon = wonMarkets.reduce((acc, m) => {
    const totalPool = parseInt(m.total_yes || 0) + parseInt(m.total_no || 0);
    const winningPool = m.resolved_answer === 'YES' ? parseInt(m.total_yes || 0) : parseInt(m.total_no || 0);
    
    const myBetEntry = m.resolved_answer === 'YES' 
      ? Object.entries(m.yes_bets || {}).find(([k]) => k.toLowerCase() === userAddress)
      : Object.entries(m.no_bets || {}).find(([k]) => k.toLowerCase() === userAddress);
      
    const myBet = myBetEntry ? parseInt(myBetEntry[1]) : 0;
    
    const payout = winningPool > 0 ? Math.floor((myBet * totalPool) / winningPool) : 0;
    return acc + payout;
  }, 0);

  return (
    <div className="app-container">
      <nav className="navbar">
        <div className="nav-brand">
          <div className="brand-icon">
            <Activity color="white" size={24} />
          </div>
          <div>
            <div className="brand-title">CogniFlux</div>
            <div className="brand-subtitle">Decentralized Prediction Market</div>
          </div>
        </div>

        <div className="nav-controls">

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
                <span style={{ padding: '4px 10px', background: 'rgba(255,255,255,0.1)', borderRadius: '12px', fontSize: '0.85rem' }}>
                  {walletBalance} GEN
                </span>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981', display: 'inline-block' }}></span>
                {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
              </span>
              <button 
                onClick={() => setShowDashboard(true)} 
                style={{ background: 'rgba(99, 102, 241, 0.2)', border: '1px solid rgba(99, 102, 241, 0.5)', color: 'white', padding: '4px 8px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}
              >
                <PieChart size={14} /> Dashboard
              </button>
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
          
          <div className="glass-panel" style={{ marginTop: '20px', background: 'linear-gradient(145deg, rgba(30, 41, 59, 0.7), rgba(15, 23, 42, 0.9))', border: '1px solid rgba(99, 102, 241, 0.3)' }}>
            <div className="panel-header">
              <Activity size={20} color="#10b981" /> Global TVL
            </div>
            <div className="panel-desc">Total GEN Wagered Across All Markets</div>
            <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: '#10b981', marginTop: '10px', textShadow: '0 0 20px rgba(16, 185, 129, 0.3)' }}>
              {totalTVL} GEN
            </div>
          </div>
        </div>

        <div className="markets-container">
          <div className="section-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div><PlayCircle color="#6366f1" size={28} /> Active Markets</div>
            <div className="tab-controls" style={{ display: 'flex', gap: '10px' }}>
              {['ALL', 'OPEN', 'RESOLVED'].map(tab => (
                <button 
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  style={{
                    background: activeTab === tab ? '#6366f1' : 'transparent',
                    border: '1px solid #6366f1',
                    color: 'white',
                    padding: '5px 15px',
                    borderRadius: '20px',
                    cursor: 'pointer',
                    fontSize: '0.85rem'
                  }}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>
          
          {!walletAddress ? (
            <div className="empty-state">Please connect your wallet to view active markets.</div>
          ) : !contractAddress ? (
            <div className="empty-state">Please set the contract address to load markets.</div>
          ) : marketsList.length === 0 ? (
            <div className="empty-state">No markets found. Create one to get started!</div>
          ) : (
            marketsList.map((market) => {
              const totalPool = parseInt(market.total_yes) + parseInt(market.total_no);
              const yesPercent = totalPool > 0 ? Math.round((parseInt(market.total_yes) / totalPool) * 100) : 50;
              const isTrending = market.status === 'OPEN' && totalPool > 0 && totalPool === maxPool;
              
              return (
                <div key={market.id} className={`market-card ${isTrending ? 'trending-glow' : ''}`}>
                  <div className="market-header">
                    <div className="market-question">{market.question}</div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      {isTrending && (
                        <div className="status-badge" style={{ background: 'linear-gradient(90deg, #ff8a00, #e52e71)', border: 'none', color: 'white' }}>
                          Trending 🔥
                        </div>
                      )}
                      <div className={`status-badge ${market.status === 'OPEN' ? 'status-live' : 'status-resolved'}`}>
                        {market.status}
                      </div>
                    </div>
                  </div>

                  <div className="progress-section">
                    <div className="progress-labels">
                      <span className="text-yes">Yes {yesPercent}%</span>
                      <span className="text-pool">Total Pool: {totalPool} GEN</span>
                      <span className="text-no">No {100 - yesPercent}%</span>
                    </div>
                    <div className="progress-bar-container">
                      <div className={`progress-yes ${isTrending ? 'pulse-anim' : ''}`} style={{ width: `${yesPercent}%` }} />
                      <div className={`progress-no ${isTrending ? 'pulse-anim' : ''}`} style={{ width: `${100 - yesPercent}%` }} />
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
                            placeholder="News URL (e.g. https://bbc.com/... avoid Wikipedia)"
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
                    <div className="resolved-result" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontSize: '0.9rem', color: '#94a3b8', marginBottom: '5px' }}>Final Result</div>
                        <div className={`result-answer result-${market.resolved_answer}`}>
                          {market.resolved_answer}
                        </div>
                        {market.resolve_reason && (
                          <div style={{ marginTop: '10px', fontSize: '0.85rem', color: '#cbd5e1', fontStyle: 'italic', maxWidth: '400px', lineHeight: '1.4' }}>
                            "{market.resolve_reason}"
                          </div>
                        )}
                      </div>
                      
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '10px' }}>
                        <CheckCircle size={36} className={`result-${market.resolved_answer}`} style={{ opacity: 0.5 }} />
                        
                        {(() => {
                          const userAddress = walletAddress?.toLowerCase();
                          if (!userAddress) return null;
                          
                          const hasBet = Object.keys(market.yes_bets || {}).some(addr => addr.toLowerCase() === userAddress) ||
                                         Object.keys(market.no_bets || {}).some(addr => addr.toLowerCase() === userAddress);
                          
                          if (!hasBet) return null;
                          
                          const hasClaimed = (market.claimed || []).some(addr => addr.toLowerCase() === userAddress);
                          
                          const betAmount = market.yes_bets?.[Object.keys(market.yes_bets || {}).find(k => k.toLowerCase() === userAddress)] || 
                                            market.no_bets?.[Object.keys(market.no_bets || {}).find(k => k.toLowerCase() === userAddress)] || 0;
                          
                          const payoutAmount = market.resolved_answer === "INVALID" ? betAmount : betAmount * 2;
                          
                          return (
                            <div style={{ marginTop: '10px' }}>
                              {hasClaimed ? (
                                <span style={{ color: '#10b981', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                  <CheckCircle size={16} /> {payoutAmount} GEN Reward Paid Out Autonomously!
                                </span>
                              ) : (
                                <span style={{ color: '#ef4444', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                  🔥 Bet Burned
                                </span>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </main>
      
      <AnimatePresence>
        {showDashboard && (
          <div className="modal-overlay" onClick={() => setShowDashboard(false)} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }} 
              animate={{ opacity: 1, scale: 1, y: 0 }} 
              exit={{ opacity: 0, scale: 0.9, y: 20 }} 
              onClick={e => e.stopPropagation()}
              className="glass-panel" 
              style={{ width: '90%', maxWidth: '500px', maxHeight: '80vh', overflowY: 'auto' }}
            >
              <div className="panel-header" style={{ justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '15px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <User color="#10b981" size={24} /> 
                  <span style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>My Dashboard</span>
                </div>
                <button onClick={() => setShowDashboard(false)} style={{ background: 'transparent', border: 'none', color: 'white', cursor: 'pointer', fontSize: '1.5rem' }}>&times;</button>
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginTop: '25px' }}>
                <div style={{ background: 'rgba(255,255,255,0.05)', padding: '20px', borderRadius: '16px', textAlign: 'center', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: '8px' }}><Wallet size={16} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '5px' }}/>Wagered</div>
                  <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: 'white' }}>{totalWagered} GEN</div>
                </div>
                <div style={{ background: 'rgba(16, 185, 129, 0.1)', padding: '20px', borderRadius: '16px', textAlign: 'center', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                  <div style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: '8px' }}><Award size={16} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '5px' }}/>Won</div>
                  <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#10b981' }}>{totalWon} GEN</div>
                </div>
              </div>
              <div style={{ background: 'rgba(168, 85, 247, 0.1)', padding: '20px', borderRadius: '16px', textAlign: 'center', marginTop: '15px', border: '1px solid rgba(168, 85, 247, 0.2)' }}>
                <div style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: '8px' }}><TrendingUp size={16} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '5px' }}/>Win Rate</div>
                <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#a855f7' }}>{winRate}%</div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default App;
