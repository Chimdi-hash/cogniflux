import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, Cpu, Network, CheckCircle2, Orbit } from 'lucide-react';
import './index.css';

function App() {
  const [idea, setIdea] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [remark, setRemark] = useState('');
  const [validatorsStatus, setValidatorsStatus] = useState([
    { id: 1, active: false },
    { id: 2, active: false },
    { id: 3, active: false },
    { id: 4, active: false },
    { id: 5, active: false },
  ]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!idea.trim()) return;

    setIsSubmitting(true);
    setRemark('');
    
    // Reset validators
    setValidatorsStatus(v => v.map(val => ({ ...val, active: false })));

    // Simulate GenLayer consensus process
    for (let i = 0; i < 5; i++) {
      await new Promise(resolve => setTimeout(resolve, 800));
      setValidatorsStatus(prev => 
        prev.map(v => v.id === i + 1 ? { ...v, active: true } : v)
      );
    }

    // Simulate returning the result from GenLayer Intelligent Contract
    await new Promise(resolve => setTimeout(resolve, 600));
    
    // A mock futuristic remark based on the idea
    const mockRemarks = [
      "Neural pathways aligned; this concept disrupts the meta-grid with unprecedented tokenomics.",
      "A high-frequency paradigm shift. The oracle nodes approve this hyper-structure.",
      "Vibe check passed: Sub-routine aesthetics are cyber-optimal, but mind the quantum gas fees.",
      "Concept registered. The neural consensus predicts a 99.8% probability of memetic virality.",
      "Warning: Idea density exceeds standard parameters. Proceed with cybernetic enhancements."
    ];
    
    setRemark(mockRemarks[Math.floor(Math.random() * mockRemarks.length)] + " [Consensus reached by 5/5 Validators]");
    setIsSubmitting(false);
  };

  return (
    <div className="app-container">
      <motion.header
        initial={{ opacity: 0, y: -50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
      >
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          style={{ display: 'inline-block', marginBottom: '1rem' }}
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
        <span className="contract-address">0xGL...4F9A</span>
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
                Initializing Consensus...
              </>
            ) : (
              <>
                <Zap size={20} />
                Evaluate via Intelligent Contract
              </>
            )}
          </button>
        </form>

        {isSubmitting && (
          <div className="validators-section">
            {validatorsStatus.map((v) => (
              <motion.div 
                key={v.id} 
                className={`validator ${v.active ? 'active' : ''}`}
                animate={v.active ? { y: [0, -10, 0] } : {}}
                transition={{ duration: 0.5 }}
              >
                <div className="validator-icon">
                  {v.active ? <CheckCircle2 size={16} /> : <Cpu size={16} />}
                </div>
                <span>Val {v.id}</span>
              </motion.div>
            ))}
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
              <label>Intelligent Contract Output</label>
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
              <h3>Submit to Contract</h3>
              <p>Your idea is sent to the `submit_idea` write function on the deployed GenLayer contract.</p>
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
              <p>5 independent validators evaluate the LLM's cyberpunk remark against the strict criteria.</p>
            </div>
          </div>
          <div className="step">
            <div className="step-number">4</div>
            <div className="step-content">
              <h3>State Update</h3>
              <p>If consensus is reached, the state is updated and you can read the remark via `get_latest_remark`.</p>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

export default App;
