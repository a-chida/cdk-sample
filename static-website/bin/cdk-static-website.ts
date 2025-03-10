#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { CdkStaticWebsiteStack } from "../lib/cdk-static-website-stack";

const app = new cdk.App();
new CdkStaticWebsiteStack(app, "CdkStaticWebsiteStack", {
  env: { region: "us-east-1" },
});
