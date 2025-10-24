# Wellness Chain Sync

A decentralized, privacy-first health metrics platform enabling individuals to securely document wellness activities, establish personalized health objectives, and earn milestone recognition badges on the blockchain.

## What is Wellness Chain Sync?

Wellness Chain Sync is a Clarity-based smart contract application that provides immutable tracking of personal health behaviors. Users maintain complete sovereign control over their wellness data while benefiting from transparent, tamper-proof records of their daily health activities. The platform computes a dynamic vitality index that reflects real-time progress toward health objectives.

### Key Features

- **Activity Documentation**: Log daily sleep duration, hydration intake, and meditation practice
- **Personalized Objectives**: Define individualized targets for each wellness metric
- **Vitality Scoring**: Real-time calculation of wellness progress based on goal attainment
- **Achievement Recognition**: Earn and collect permanent badges marking milestone accomplishments
- **Data Sovereignty**: User-controlled records with no central authority access
- **Cryptographic Verification**: Immutable on-chain proof of all health activities

## How It Works

The Wellness Chain Sync contract manages four primary data domains:

- **Account Registry**: User profiles with registration timestamps and current vitality metrics
- **Activity Log**: Daily health measurements indexed by user and date
- **Wellness Targets**: Personalized goals for sleep, hydration, and mindfulness
- **Badge Inventory**: Earned achievements with timestamps and metadata

The system enforces realistic boundaries for health measurements (sleep: 0-24 hours, hydration: 0-10L, mindfulness: 0-1440 minutes) and prevents duplicate entries on the same calendar day.

## Getting Started

### Installation

Prerequisites:
- Clarinet 2.0+
- Node.js 18+

Clone and initialize:
```bash
clarinet new wellness-chain-sync
cd wellness-chain-sync
npm install
```

### Quick Start Example

Define your health targets:
```clarity
(contract-call? .vitality-ledger configure-wellness-objectives
    u8    ;; target sleep hours
    u2500 ;; target hydration (ml)
    u30)  ;; target mindfulness (minutes)
```

Document today's wellness activities:
```clarity
(contract-call? .vitality-ledger submit-daily-metrics
    u7    ;; actual sleep hours
    u1800 ;; actual hydration consumed
    u25)  ;; actual mindfulness practice
```

Retrieve your vitality profile:
```clarity
(contract-call? .vitality-ledger query-account-profile tx-sender)
```

## Function Catalog

### Configuration Functions

**configure-wellness-objectives** `(sleep-target uint) (hydration-target uint) (mindfulness-target uint) -> (response bool uint)`

Establish your personal health targets. All parameters must pass validation bounds. Returns (ok true) on success.

### Activity Recording

**submit-daily-metrics** `(sleep-hours uint) (water-consumed uint) (meditation-duration uint) -> (response uint uint)`

Record complete daily health metrics. Can only be called once per calendar day. Automatically recalculates vitality index and returns updated score.

**revise-single-measurement** `(metric-type (string-utf8 20)) (updated-value uint) -> (response bool uint)`

Modify a single metric from today's entry. Metric types: "sleep-duration", "hydration-consumption", "mindfulness-practice".

### Data Retrieval

**query-account-profile** `(target principal) -> (optional account-record)`

View account registration date, current vitality index, and activity streak count.

**fetch-activity-metrics** `(target principal) (query-date uint) -> (optional activity-record)`

Retrieve historical health measurements for any recorded date.

**retrieve-wellness-targets** `(target principal) -> (optional target-record)`

Access personalized health objectives and their last modification timestamp.

**enumerate-earned-badges** `(target principal) -> (list badge-record)`

List all achievement badges earned by the specified account.

**query-badge-specifications** `(badge-id uint) -> (optional badge-definition)`

Examine metadata for available achievement types.

## Technical Architecture

### Data Validation

The contract implements strict bounds-checking for all health measurements:
- Sleep: 0-24 hours per day
- Hydration: 0-10,000 ml per day  
- Mindfulness: 0-1,440 minutes per day

Measurements outside these ranges trigger validation errors.

### Vitality Score Calculation

The vitality index integrates three components:
1. **Baseline momentum**: 10% of previous day's score
2. **Current performance**: 90% weight on today's goal-achievement percentage
3. **Streak penalty**: Decreases by 5 points for non-reporting days

Formula: `new-score = (prior-score ÷ 10) + (mean-compliance × 0.9)`

### Daily Entry Management

The system uses normalized date identifiers to prevent duplicate same-day entries. Each metric set is timestamped at submission and linked to a calendar day, enabling historical queries and multi-day tracking.

## Security & Privacy

### Design Principles

- **Principal-Based Access**: All data associated with user principals; no cross-user visibility
- **Immutable Records**: Once submitted, historical metrics cannot be altered
- **Execution Restrictions**: Demographic features prevent unauthorized modifications
- **One-Entry-Per-Day**: Built-in duplicate prevention mechanism

### Usage Guidelines

- Validate all measurement values before contract submission
- Maintain careful records of achievement milestones
- Regularly audit historical data for accuracy
- Understand that badge awards cannot be revoked after issuance

## Development & Testing

### Run the Test Suite

```bash
npm test
```

### Launch Interactive Console

```bash
clarinet console
```

### Verify Contract Logic

```bash
clarinet check
```

## Project Structure

```
├── contracts/
│   └── vitality-ledger.clar      ;; Core smart contract
├── tests/
│   └── vitality-ledger_test.ts   ;; Test specifications
├── settings/
│   ├── Devnet.toml
│   ├── Testnet.toml
│   └── Mainnet.toml
└── Clarinet.toml                 ;; Project configuration
```

## License

ISC