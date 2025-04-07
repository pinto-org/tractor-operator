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

3. Update the `.env` file with your RPC URL and private key:
```
RPC_URL=https://mainnet.infura.io/v3/YOUR_INFURA_API_KEY
PRIVATE_KEY=your_wallet_private_key_here
CHECK_INTERVAL=10000  # Check interval in milliseconds (10000 = 10 seconds)
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

## Customization

To implement your specific on-chain action logic:

1. Update the `checkActionCanBeExecuted()` function in `src/index.ts` to determine when the action should be executed.
2. Update the `executeAction()` function in `src/index.ts` to perform the action when conditions are met.

## Security Notes

- Never commit your `.env` file containing your private key
- Consider using a hardware wallet or key management solution for production deployments
- The private key in the `.env` file should be for a wallet with only the minimum necessary funds 