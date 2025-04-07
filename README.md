# Tractor Operator Bot

A blockchain monitoring bot that checks if a specific on-chain action can be executed.

## Setup

1. Install dependencies:
```bash
yarn install
```

2. Create a `.env` file:
```bash
cp .env.example .env
```

3. Update the `.env` file with your RPC URL, private key, protocol address, and execution mode:
```
RPC_URL=https://mainnet.infura.io/v3/YOUR_INFURA_API_KEY
PRIVATE_KEY=your_wallet_private_key_here
CHECK_INTERVAL=10000  # Check interval in milliseconds (10000 = 10 seconds)
PROTOCOL_ADDRESS=0xD1A0D188E861ed9d15773a2F3574a2e94134bA8f  # Pinto protocol contract address
EXECUTION_MODE=preview  # "preview" for simulation only, "execute" to actually send transactions
```

## Usage

### Development
```bash
yarn run dev
```

### Production
```bash
yarn run build
yarn start
```

### Execution Modes

The bot can operate in two modes:

1. **Preview Mode (`EXECUTION_MODE=preview`)**: The bot will simulate transactions but not actually send them to the blockchain. This is useful for testing and monitoring without spending gas. You'll see detailed simulation results including error messages for transactions that would fail.

2. **Execute Mode (`EXECUTION_MODE=execute`)**: The bot will both simulate transactions and, if the simulation is successful, send them to the blockchain. This mode is used when you want the bot to actually perform actions on-chain.

By default, the bot runs in preview mode. To enable execution, set `EXECUTION_MODE=execute` in your `.env` file.

## Customization

To implement your specific on-chain action logic:

1. Update the `checkActionCanBeExecuted()` function in `src/index.ts` to determine when the action should be executed.
2. Update the `executeAction()` function in `src/index.ts` to perform the action when conditions are met.

## Security Notes

- Never commit your `.env` file containing your private key
- Consider using a hardware wallet or key management solution for production deployments
- The private key in the `.env` file should be for a wallet with only the minimum necessary funds 

