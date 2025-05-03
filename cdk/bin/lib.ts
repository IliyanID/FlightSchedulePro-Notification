import * as cdk from 'aws-cdk-lib';
import { FlightCheckerStack } from '../lib/flight-checker-stack';

const app = new cdk.App();
new FlightCheckerStack(app, 'FlightChecker', {
});