# CogniFlux 🌌
**Decentralized AI Prediction Market on GenLayer**

CogniFlux is a next-generation decentralized application built on the **GenLayer Studio Network**. Unlike traditional prediction markets that rely on centralized oracles or subjective human reporters, CogniFlux utilizes GenLayer's "Intelligent Contracts" to resolve real-world event outcomes through decentralized AI consensus!

Anyone can deploy a prediction market, place bets with test GEN tokens, and let a decentralized swarm of AI validators determine the final outcome using live internet data.

## 🚀 Features

- **AI-Native Market Resolution**: Leverages GenLayer's GenVM. When a market is resolved, AI validators browse the provided News URL, read the contents, and reach consensus on whether the event occurred (YES, NO, or INVALID).
- **Fully On-Chain Logic**: Market creation, betting pools, and resolution are handled securely by an Intelligent Python Contract on the GenLayer network.
- **Futuristic UI**: Built with React and Framer Motion for a sleek, glassmorphic, cyberpunk aesthetic.
- **Web3 Wallet Integration**: Seamlessly connects to MetaMask and automatically switches to the GenLayer Studio Network.
- **Mobile Responsive**: Perfectly optimized for both desktop and mobile users.

## 🛠️ Tech Stack

- **Frontend**: React (Vite), Vanilla CSS, Framer Motion, Lucide React
- **Blockchain SDK**: `genlayer-js`, `viem`
- **Smart Contract**: Python (`genlayer` SDK)
- **Network**: GenLayer Studio Network (Chain ID: 61999)

## 📂 Project Structure

- `genlayer-app/contract.py`: The core Intelligent Contract written in Python. It handles balances, market states, and uses `@gl.public.write` along with `gl.eq_principle.prompt_non_comparative` for AI-driven resolution.
- `genlayer-app/src/App.jsx`: The main React component handling wallet connections, transaction signing, and dynamic UI state.
- `genlayer-app/src/index.css`: Contains the cyberpunk styling, mobile media queries, and animations.

## ⚙️ How It Works

1. **Connect & Request Funds**: Connect your MetaMask wallet. The app ensures you are on the GenLayer Studio Network. Click "Request 5 GEN" to mint test tokens directly from the smart contract to your address.
2. **Deploy a Market**: Ask a verifiable real-world question (e.g. "Did the Celtics win the 2024 NBA Finals?") and deploy it on-chain.
3. **Place Bets**: Users can deposit their GEN tokens into the YES or NO pools. The smart contract dynamically tracks the odds.
4. **Resolve with AI**: Provide a reliable news URL to resolve the market. The GenLayer validators will fetch the webpage, read it using an LLM, and vote on the truth. The market is settled instantly based on AI consensus!

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
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

## 📜 Smart Contract Deployment

To deploy your own backend:
1. Copy the contents of `genlayer-app/contract.py`.
2. Head to the [GenLayer Studio](https://studio.genlayer.com).
3. Deploy it as a new Intelligent Contract.
4. Update the `contractAddress` state variable inside `src/App.jsx` with your new deployment address!

---
*Built for the GenLayer ecosystem.*
