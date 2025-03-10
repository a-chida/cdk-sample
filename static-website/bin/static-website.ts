#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { StaticWebsiteStack } from "../lib/static-website-stack";

const app = new cdk.App();
new StaticWebsiteStack(app, "StaticWebsiteStack", {
  env: { region: "us-east-1" },
});
