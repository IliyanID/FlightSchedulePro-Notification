# FlightSchedulePro Notification

A lightweight AWS CDK project that periodically logs in to FlightSchedulePro, fetches your next 14 days of availability, finds qualifying free slots (≥ 1.5 h between 9 AM–5 PM MT), and sends you an email alert via SNS.

## Features

- **Automated login** with retry on failure  
- **Schedule fetch** for the next 14 days  
- **Gap detection** for instructor + plane ≥ 1.5 h between 09:00–17:00 America/Denver  
- **Email alerts** via SNS  
- **Secrets Manager**–backed password  

## Prerequisites

- **AWS CDK v2**  
- **Node.js 18**  
- **AWS credentials** configured (via `aws configure`)  
- Confirmed **SNS email subscription**  

## Installation

```bash
npm install
```

## Build

```bash
npm run build
```

## Deploy

1. Bootstrap (if not already):  
   ```bash
   cdk bootstrap
   ```
2. Deploy:  
   ```bash
   cdk deploy
   ```

## Configuration

- **Email**: set `const EMAIL = 'you@example.com'` in `lib/flight-checker-stack.ts`.  
- **Secrets**: update the `CHANGE_ME_TO_YOUR_SECRET` placeholder or replace the `/flight-checker/password` secret in Secrets Manager.  

## Usage

The CDK stack provisions:

- **SecretsManager Secret** at `/flight-checker/password`  
- **SNS Topic** (`FlightCheckerAlerts`) with your email subscription  
- **Lambda Function** (`FlightCheckerHandler`)  
- **EventBridge Rule** (`HourlyRule`) firing on your specified schedule  

When a qualifying slot is found, you’ll receive an email with details like:

```
✈️ Cessna N855CP & 👩‍✈️ Jonathon Richards free: 2025-05-06 09:00 AM → 2025-05-06 10:30 AM (1.50h)
```

## Customizing the Schedule

By default the rule runs MT 09–17 via UTC conversion (`0 0 16-23,0 * * *`). To tweak:

```ts
new events.Rule(this, 'HourlyRule', {
  schedule: events.Schedule.cron({
    minute: '0',
    hour:   '16-23,0',  // UTC hours → MT 09–17
  }),
  targets: [ new targets.LambdaFunction(fn) ],
});
```

For testing every minute:

```ts
new events.Rule(this, 'EveryMinuteRule', {
  schedule: events.Schedule.rate(cdk.Duration.minutes(1)),
  targets: [ new targets.LambdaFunction(fn) ],
});
```

## License

MIT © Your Name
