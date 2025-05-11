#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { FargateServiceStack } from "../lib/fargate-service-stack";

const app = new cdk.App();
new FargateServiceStack(app, "FargateServiceStack");
