# KeeperHub Developer Feedback

## Overview

While building EthTix — an AI-powered event ticketing agent on Ethereum — we evaluated KeeperHub's MCP server and CLI tooling for integrating payment rails into our agent's booking pipeline. This document captures our developer experience, friction points, and suggestions.

---

## What We Evaluated

- **KeeperHub MCP Server** — for agent-to-payment-rail communication
- **KeeperHub CLI** — for local development and testing
- **x402/MPP payment protocols** — for structured payment settlement between our agent and event organizers

Our use case: an AI agent that autonomously discovers events, checks calendars, and processes ticket payments on-chain. We explored KeeperHub as a middleware layer between the agent's booking decisions and the actual ETH transfer execution.

---

## Positive Feedback

### 1. Clear Mental Model
The concept of separating payment orchestration from application logic is sound. For an AI agent that handles multiple payment flows (platform fees, ticket purchases, refunds), having a dedicated payment rail layer would reduce complexity in the agent code.

### 2. MCP Server Approach
Using the Model Context Protocol for agent-payment integration is forward-thinking. It aligns well with how modern AI agents are structured — the agent calls tools, and KeeperHub can be one of those tools. This is the right abstraction level.

### 3. Multi-Framework Support
Supporting ElizaOS, OpenClaw, LangChain, and CrewAI as integration targets is practical. Most hackathon teams use one of these frameworks, so having connectors ready reduces onboarding friction.

---

## UX Friction & Issues

### 1. Onboarding Documentation Gap
The initial setup documentation assumes familiarity with x402 and MPP protocols. For developers coming from a standard web3 background (ethers.js, wagmi, viem), there's a conceptual gap between "I want to send ETH" and "I want to use a payment rail." A "Getting Started for Web3 Devs" guide with a simple end-to-end example (connect wallet → create payment intent → settle on-chain → confirm) would significantly reduce onboarding time.

**Suggestion:** Add a 5-minute quickstart that takes a developer from zero to a working payment in a single-page app. Show the equivalent of:
```
// Without KeeperHub
await wallet.sendTransaction({ to, value })

// With KeeperHub — what does this look like?
```

### 2. MCP Server Discovery
Finding the correct MCP server endpoint and understanding its capabilities required digging through multiple pages. The MCP tool definitions (what parameters each tool accepts, what it returns) should be front and center in the docs, ideally as a single reference page with copy-pastable JSON schemas.

**Suggestion:** A single `/reference` page listing every MCP tool with:
- Tool name
- Input schema (JSON)
- Output schema (JSON)
- Example request/response
- Error codes

### 3. Testnet Support Clarity
It wasn't immediately clear which testnets KeeperHub supports and whether the x402 protocol works on Sepolia, Goerli, or only mainnet. For hackathon developers, testnet support is essential — we need to demo without real funds.

**Suggestion:** Add a prominent "Supported Networks" section with testnet faucet links and example contract addresses for each supported testnet.

### 4. Agent Framework Connector Docs
While the docs mention LangChain and CrewAI connectors, the actual integration code examples are minimal. For a hackathon team trying to wire KeeperHub into an existing agent (like our Groq-based agent), we need:
- A complete working example (not just snippets)
- How to handle payment confirmation callbacks
- How to handle failed/reverted payments
- How to query payment status

**Suggestion:** Provide a GitHub repo with a minimal but complete agent that uses KeeperHub for payments — something a developer can clone, add their API key, and have working in 10 minutes.

### 5. Error Messages
When testing the CLI, error messages were sometimes generic ("Request failed") without indicating whether the issue was authentication, network, parameter validation, or server-side. Structured error responses with error codes and actionable messages would speed up debugging.

**Suggestion:** Return errors in a consistent format:
```json
{
  "error": {
    "code": "INVALID_AMOUNT",
    "message": "Payment amount must be greater than 0",
    "hint": "Ensure the 'amount' field is a positive integer in wei"
  }
}
```

---

## Missing Features

### 1. Webhook/Callback for Payment Confirmation
For an AI agent that processes payments asynchronously (user confirms in MetaMask, transaction mines on-chain), we need a webhook or callback mechanism that notifies the agent when a payment settles. Currently, we poll the blockchain ourselves — KeeperHub could abstract this.

### 2. Multi-Recipient Batch Payments
Our use case involves booking tickets for multiple attendees in a single conversation. A batch payment API that handles multiple transfers in one call (or one transaction) would reduce gas costs and simplify the agent logic.

### 3. Payment Intent Pre-Validation
Before asking the user to sign a transaction, the agent should be able to pre-validate: "Will this payment succeed?" (balance check, gas estimation, allowance check for ERC-20). A `validatePayment()` tool in the MCP server would prevent failed transactions and improve UX.

### 4. Receipt Generation
After a payment settles, KeeperHub could generate a structured receipt (JSON or PDF) that includes: transaction hash, block number, timestamp, amount, sender, recipient, and a verification URL. We currently build this ourselves in our email template — having it as a KeeperHub feature would save time.

### 5. Refund Flow
Event cancellations require refunds. A `refundPayment()` tool that reverses a previous payment (by reference ID) would be valuable. Currently, refund logic has to be built from scratch in the smart contract.

---

## Integration Recommendations

For a project like EthTix, the ideal KeeperHub integration would look like:

1. **Agent decides to book** → calls KeeperHub MCP tool `createPaymentIntent(amount, recipient, metadata)`
2. **KeeperHub returns** a payment intent with a transaction to sign
3. **User signs in MetaMask** → KeeperHub monitors the transaction
4. **Payment confirms** → KeeperHub calls webhook → agent proceeds to mint NFT
5. **Agent sends receipt** → KeeperHub provides structured receipt data

This flow would replace ~50 lines of custom viem/wagmi code in our agent with 3-4 MCP tool calls, and would add payment tracking, receipts, and refund capability for free.

---

## Summary

| Area | Rating | Notes |
|------|--------|-------|
| Concept & Vision | Strong | Payment rails for AI agents is the right abstraction |
| Documentation | Needs Work | Missing quickstart, reference docs, and complete examples |
| Testnet Support | Unclear | Not obvious which networks are supported |
| Error Handling | Needs Work | Generic errors slow down debugging |
| Agent Integration | Promising | MCP approach is correct, needs more framework examples |
| Missing Features | Several | Webhooks, batch payments, pre-validation, receipts, refunds |

**Overall:** KeeperHub is solving the right problem. The gap is primarily in developer experience — documentation, examples, and error handling. With a 10-minute quickstart guide and a reference agent implementation, adoption at hackathons would increase significantly.

---

*Feedback submitted as part of the ETHGlobal Open Agents hackathon by the EthTix team.*
