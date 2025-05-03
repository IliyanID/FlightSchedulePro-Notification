// lib/flight-checker-stack.ts
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as subs from 'aws-cdk-lib/aws-sns-subscriptions';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { join } from 'path';

const EMAIL = 'iliyanid2000@gmail.com';

export class FlightCheckerStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const passwordSecret = new secretsmanager.Secret(this, 'FlightCheckerSecret', {
      secretName: '/flight-checker/password',
      secretStringValue: cdk.SecretValue.plainText('CHANGE_ME_TO_YOUR_SECRET'),
    });

    const alertTopic = new sns.Topic(this, 'FlightCheckerAlerts', {
      displayName: 'Flight Checker Alert Topic',
    });
    alertTopic.addSubscription(new subs.EmailSubscription(EMAIL));

    const fn = new NodejsFunction(this, 'FlightCheckerHandler', {
      runtime: lambda.Runtime.NODEJS_18_X,
      code: lambda.Code.fromAsset(join(__dirname, '../../dist')),
      handler: 'index.handler',
      environment: {
        EMAIL,
        SECRET_ARN: passwordSecret.secretArn,
        ALERT_TOPIC_ARN: alertTopic.topicArn,
      },
      timeout: cdk.Duration.seconds(30)
    });

    passwordSecret.grantRead(fn);
    alertTopic.grantPublish(fn);

    new events.Rule(this, 'HourlyRule', {
      schedule: events.Schedule.cron({
        minute: '0',
        hour: '16-23,0',  
      }),
      targets: [ new targets.LambdaFunction(fn) ],
    });
  }
}
