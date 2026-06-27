# CogniFlux 🌌
**Intelligent Contract Idea Evaluator on GenLayer**

CogniFlux is a next-generation decentralized application built on the **GenLayer Studio Network**. Unlike traditional dApps, CogniFlux utilizes GenLayer's "Intelligent Contracts"—smart contracts capable of executing non-deterministic LLM prompts. 

Users can submit their boldest, most complex Web3 ideas, and a decentralized swarm of 5 AI validators will reach consensus to deliver a cyberpunk-style judgment on the project's vibe and potential.

## 🚀 Features

- **AI-Native Consensus**: Leverages `genlayer-js` to interface with GenLayer's GenVM. Transactions are processed by LLM-backed validators.
- **Gasless Evaluation**: Connecting and submitting your idea is completely free (0 GEN).
- **Futuristic UI**: Built with React and Framer Motion for a sleek, glassmorphic, cyberpunk aesthetic.
- **Web3 Wallet Integration**: Seamlessly connects to MetaMask and automatically switches to the GenLayer Studio Network.

## 🛠️ Tech Stack

- **Frontend**: React (Vite), Vanilla CSS, Framer Motion, Lucide React
- **Blockchain SDK**: `genlayer-js`, `viem`
- **Smart Contract**: Python (`genlayer` SDK)
- **Network**: GenLayer Studio Network (Chain ID: 61999)

## 📂 Project Structure

- `contract.py`: The core Intelligent Contract written in Python. It uses `@gl.public.write` and `gl.eq_principle.prompt_non_comparative` to process user input through GenLayer's AI validators.
- `src/App.jsx`: The main React component handling wallet connections, transaction signing, and UI state management.
- `src/index.css`: Contains the cyberpunk-inspired styling and dynamic keyframe animations.

## ⚙️ How It Works

1. **Connect & Evaluate**: Connect your MetaMask wallet. The app ensures you are on the GenLayer Studio Network.
2. **Submit Idea**: Type in your Web3 project idea and click **EVALUATE**.
3. **Sign Transaction**: Sign a free transaction (0 GEN) in MetaMask to trigger the `submit_idea` method on the intelligent contract.
4. **AI Consensus**: The GenLayer validators analyze the prompt. The frontend will blink `"5 validators are running judgement............"` while it waits up to 5 minutes for the network to finalize the LLM consensus.
5. **Final Judgment**: Once finalized, the smart contract state updates, and the AI's cyberpunk remark is displayed dynamically on the screen!

## 💻 Local Development

### Prerequisites
- Node.js (v18+)
- npm or yarn
- MetaMask Browser Extension

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/Chimdi-hash/cogniflux.git
   cd cogniflux/genlayer-app
