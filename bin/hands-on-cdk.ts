#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { FargateServiceStack } from "../lib/fargate-service-stack";
import { UrlShortenerStack } from "../lib/url-shortener-stack";

const app = new cdk.App();

// サーバーレスURLサービスをデプロイ
new UrlShortenerStack(app, "UrlShortenerStack");

// Fargate/ALBスタックはオプションでデプロイ（コストがかかるためコメントアウト）
// new FargateServiceStack(app, "FargateServiceStack");
