# `work-fund-lab`: Simple & Seamless Crowdfunding Contracts

A decentralized crowdfunding platform on Ethereum: *workers* propose work and
lock terms on-chain (stored on IPFS), *funders* deposit ERC20 tokens to
support the work, and *oracles* cryptographically review terms and authorize
milestone payouts via EIP-712 signatures.

## Quick Start

```
nvm use 24
npm install
```

## Local Run (Dapp)

The web app used by the local gateway runs from `packages/dapp`.

```bash
cd packages/dapp
PORT=3001 npm run dev
# -> http://localhost:3001
```

## Repository Docs

- Dapp README: [packages/dapp/README.md](packages/dapp/README.md)
- Contracts package: [packages/chain/README.md](packages/chain/README.md)
- Additional project docs: [docs/](docs/)

## Tech Stack

- **Smart Contracts**: [HardHatv3](https://hardhat.org/)
- **Front-end**: [React](https://react.dev/) (via NextJS) w/ [Reown Appkit](https://docs.reown.com/overview)
- **Back-end**: [NextJS](https://nextjs.org/docs)

## Similar Projects

- [`%fund`](https://github.com/tocwex/fund)
- [`juicebox.eth`](https://juicebox.money/)
