import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Wallet, LogOut, CheckCircle, XCircle, AlertTriangle, PlayCircle, PlusCircle, Coins, Activity } from 'lucide-react';
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

// Contract ABI matching TruthStake
const ABI = parseAbi([
  "function mint(int256 amount)",
  "function create_market(string question)",
  "function bet(string market_id, bool is_yes, int256 amount)",
  "function resolve_market(string market_id, string resolution_url)",
  "function get_state() view returns (string)"
]);

function App() {
  const [contractAddress, setContractAddress] = useState('0xF43dAE3B76E4BF4b0D4081f571Af824303CB28e5');
  const [walletAddress, setWalletAddress] = useState('');
  const [isCorrectNetwork, setIsCorrectNetwork] = useState(true);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');

  // Protocol State
  const [protocolState, setProtocolState] = useState({
    balances: {},
    markets: {},
    next_market_id: 1
  });

  // Forms State
  const [newMarketQuestion, setNewMarketQuestion] = useState('');
  const [betAmounts, setBetAmounts] = useState({});
  const [resolveUrls, setResolveUrls] = useState({});

  useEffect(() => {
    if (window.ethereum) {
      window.ethereum.request({ method: 'eth_chainId' }).then(checkNetwork);
      window.ethereum.on('chainChanged', checkNetwork);
      window.ethereum.on('accountsChanged', handleAccountsChanged);
    }
    
    // Polling protocol state
    let intervalId;
    if (contractAddress) {
      fetchState();
      intervalId = setInterval(fetchState, 5000); // Poll every 5s
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
      const publicClient = createClient({ chain: studionet });
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
      const client = createClient({ chain: studionet });
      const hash = await client.writeContract({
        address: contractAddress,
        abi: ABI,
        functionName: functionName,
        args: args,
        account: walletAddress,
      });

      setStatusMessage(`Transaction sent! Waiting for validators (Hash: ${hash.slice(0, 8)}...)`);
      
      const receipt = await client.waitForTransactionReceipt({ hash });
      
      if (receipt.status === 'success') {
        setStatusMessage(`✅ ${successMessage}`);
        fetchState();
      } else {
        setStatusMessage('❌ Transaction failed.');
      }
    } catch (err) {
      console.error(err);
      setStatusMessage(`❌ Error: ${err.message || 'Transaction failed'}`);
    } finally {
      setTimeout(() => setStatusMessage(''), 8000);
      setIsSubmitting(false);
    }
  };

  const handleMint = () => executeTransaction('mint', [1000n], 'Minting 1000 TS Tokens...', 'Successfully minted 1000 TS Tokens!');
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

  const myBalance = protocolState.balances[walletAddress] || 0;
  const marketsList = Object.values(protocolState.markets).sort((a, b) => parseInt(b.id) - parseInt(a.id));

  return (
    <div className="min-h-screen bg-[#0a0a0e] text-slate-300 font-sans selection:bg-indigo-500/30">
      {/* Navbar */}
      <nav className="fixed top-0 w-full z-50 border-b border-indigo-500/10 bg-[#0a0a0e]/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Activity className="text-white w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight">TruthStake</h1>
              <p className="text-xs text-indigo-400 font-medium">Decentralized Prediction Market</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {contractAddress && walletAddress && (
              <div className="flex items-center gap-2 px-4 py-2 bg-indigo-500/10 border border-indigo-500/20 rounded-full">
                <Coins className="w-4 h-4 text-indigo-400" />
                <span className="text-sm font-semibold text-indigo-300">{myBalance} TS Tokens</span>
                <button 
                  onClick={handleMint}
                  disabled={isSubmitting}
                  className="ml-2 text-xs bg-indigo-500 hover:bg-indigo-600 text-white px-2 py-1 rounded-md transition-colors"
                >
                  Mint 1000
                </button>
              </div>
            )}
            
            {!walletAddress ? (
              <button onClick={connectWallet} className="flex items-center gap-2 bg-white text-black px-6 py-2.5 rounded-full font-medium hover:bg-slate-200 transition-all">
                <Wallet className="w-4 h-4" /> Connect Wallet
              </button>
            ) : !isCorrectNetwork ? (
              <button onClick={switchNetwork} className="flex items-center gap-2 bg-red-500/10 text-red-400 border border-red-500/20 px-6 py-2.5 rounded-full font-medium hover:bg-red-500/20 transition-all">
                <AlertTriangle className="w-4 h-4" /> Switch to StudioNet
              </button>
            ) : (
              <div className="flex items-center gap-2 bg-slate-800/50 border border-slate-700 px-4 py-2.5 rounded-full">
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-sm font-medium">{walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}</span>
                <button onClick={() => setWalletAddress('')} className="ml-2 text-slate-400 hover:text-white transition-colors">
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 pt-32 pb-24">
        
        {/* Status Toast */}
        <AnimatePresence>
          {statusMessage && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="fixed top-24 right-6 z-50 bg-[#15151e] border border-indigo-500/30 p-4 rounded-xl shadow-2xl shadow-indigo-500/10 flex items-center gap-3"
            >
              <div className="w-5 h-5 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
              <p className="text-sm font-medium text-white">{statusMessage}</p>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Left Column: Settings & Create Market */}
          <div className="space-y-8">
            <div className="bg-[#111118] border border-slate-800/60 p-6 rounded-2xl">
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-indigo-400" />
                Contract Connection
              </h2>
              <p className="text-sm text-slate-400 mb-4">
                Enter the TruthStake Intelligent Contract address deployed on GenLayer Studio.
              </p>
              <input
                type="text"
                placeholder="0x..."
                value={contractAddress}
                onChange={(e) => setContractAddress(e.target.value)}
                className="w-full bg-black/40 border border-slate-800 rounded-lg px-4 py-3 text-white text-sm focus:outline-none focus:border-indigo-500 transition-colors font-mono"
              />
            </div>

            <div className="bg-[#111118] border border-slate-800/60 p-6 rounded-2xl relative overflow-hidden group">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 to-purple-600 opacity-50 group-hover:opacity-100 transition-opacity" />
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <PlusCircle className="w-5 h-5 text-purple-400" />
                Create New Market
              </h2>
              <p className="text-sm text-slate-400 mb-4">
                Ask a question about a verifiable real-world event.
              </p>
              <div className="space-y-4">
                <textarea
                  placeholder="e.g. Will SpaceX successfully launch Starship before Friday?"
                  value={newMarketQuestion}
                  onChange={(e) => setNewMarketQuestion(e.target.value)}
                  className="w-full bg-black/40 border border-slate-800 rounded-lg px-4 py-3 text-white text-sm focus:outline-none focus:border-purple-500 transition-colors resize-none h-24"
                />
                <button
                  onClick={handleCreateMarket}
                  disabled={isSubmitting || !newMarketQuestion}
                  className="w-full bg-white hover:bg-slate-200 text-black font-semibold py-3 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Deploy Market
                </button>
              </div>
            </div>
          </div>

          {/* Right Column: Markets List */}
          <div className="lg:col-span-2 space-y-6">
            <h2 className="text-2xl font-bold text-white flex items-center gap-3">
              <PlayCircle className="w-6 h-6 text-indigo-500" />
              Active Markets
            </h2>
            
            {!contractAddress ? (
              <div className="text-center p-12 border border-slate-800 border-dashed rounded-2xl bg-[#111118]/50">
                <p className="text-slate-400">Please set the contract address to load markets.</p>
              </div>
            ) : marketsList.length === 0 ? (
              <div className="text-center p-12 border border-slate-800 border-dashed rounded-2xl bg-[#111118]/50">
                <p className="text-slate-400">No markets found. Create one to get started!</p>
              </div>
            ) : (
              marketsList.map((market) => {
                const totalPool = parseInt(market.total_yes) + parseInt(market.total_no);
                const yesPercent = totalPool > 0 ? Math.round((parseInt(market.total_yes) / totalPool) * 100) : 50;
                
                return (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    key={market.id} 
                    className="bg-[#111118] border border-slate-800/60 rounded-2xl p-6 hover:border-indigo-500/30 transition-all"
                  >
                    <div className="flex justify-between items-start mb-6">
                      <h3 className="text-xl font-medium text-white leading-snug max-w-[80%]">
                        {market.question}
                      </h3>
                      {market.status === 'OPEN' ? (
                        <span className="px-3 py-1 bg-emerald-500/10 text-emerald-400 text-xs font-semibold rounded-full border border-emerald-500/20">
                          LIVE
                        </span>
                      ) : (
                        <span className="px-3 py-1 bg-slate-800 text-slate-400 text-xs font-semibold rounded-full border border-slate-700">
                          RESOLVED
                        </span>
                      )}
                    </div>

                    {/* Progress Bar */}
                    <div className="mb-6">
                      <div className="flex justify-between text-sm mb-2 font-medium">
                        <span className="text-emerald-400">Yes {yesPercent}%</span>
                        <span className="text-slate-500">Total Pool: {totalPool} TS</span>
                        <span className="text-rose-400">No {100 - yesPercent}%</span>
                      </div>
                      <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden flex">
                        <div className="h-full bg-emerald-500 transition-all duration-500" style={{ width: `${yesPercent}%` }} />
                        <div className="h-full bg-rose-500 transition-all duration-500" style={{ width: `${100 - yesPercent}%` }} />
                      </div>
                    </div>

                    {market.status === 'OPEN' ? (
                      <div className="space-y-6">
                        {/* Betting Area */}
                        <div className="flex gap-4">
                          <input
                            type="number"
                            placeholder="Amount (TS)"
                            value={betAmounts[market.id] || ''}
                            onChange={(e) => setBetAmounts({...betAmounts, [market.id]: e.target.value})}
                            className="w-1/3 bg-black/40 border border-slate-800 rounded-lg px-4 py-2 text-white text-sm focus:outline-none focus:border-indigo-500"
                          />
                          <button
                            onClick={() => handleBet(market.id, true)}
                            disabled={isSubmitting}
                            className="flex-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-medium py-2 rounded-lg transition-colors"
                          >
                            Bet YES
                          </button>
                          <button
                            onClick={() => handleBet(market.id, false)}
                            disabled={isSubmitting}
                            className="flex-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 font-medium py-2 rounded-lg transition-colors"
                          >
                            Bet NO
                          </button>
                        </div>

                        {/* Resolution Area */}
                        <div className="pt-6 border-t border-slate-800/60">
                          <p className="text-xs text-slate-400 mb-3 uppercase tracking-wider font-semibold">Resolve Market</p>
                          <div className="flex gap-3">
                            <input
                              type="text"
                              placeholder="News URL (e.g. https://reuters.com/article...)"
                              value={resolveUrls[market.id] || ''}
                              onChange={(e) => setResolveUrls({...resolveUrls, [market.id]: e.target.value})}
                              className="flex-1 bg-black/40 border border-slate-800 rounded-lg px-4 py-2 text-white text-sm focus:outline-none focus:border-indigo-500"
                            />
                            <button
                              onClick={() => handleResolve(market.id)}
                              disabled={isSubmitting}
                              className="bg-indigo-500 hover:bg-indigo-600 text-white font-medium px-6 py-2 rounded-lg transition-colors"
                            >
                              Resolve
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="p-4 rounded-xl bg-slate-800/30 border border-slate-700/50 flex items-center justify-between">
                        <div>
                          <p className="text-sm text-slate-400 mb-1">Final Result</p>
                          <p className={`text-xl font-bold ${
                            market.resolved_answer === 'YES' ? 'text-emerald-400' : 
                            market.resolved_answer === 'NO' ? 'text-rose-400' : 'text-amber-400'
                          }`}>
                            {market.resolved_answer}
                          </p>
                        </div>
                        <CheckCircle className={`w-8 h-8 ${
                            market.resolved_answer === 'YES' ? 'text-emerald-500' : 
                            market.resolved_answer === 'NO' ? 'text-rose-500' : 'text-amber-500'
                          } opacity-50`} />
                      </div>
                    )}
                  </motion.div>
                );
              })
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
