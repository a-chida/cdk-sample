import * as cdk from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import * as CdkStaticWebsite from "../lib/cdk-static-website-stack";

describe("CdkStaticWebsite", () => {
  const app = new cdk.App();
  const stack = new CdkStaticWebsite.CdkStaticWebsiteStack(app, "TestStack", {
    env: { region: "us-east-1" },
  });
  const template = Template.fromStack(stack);

  // snapshot test
  test("snapshot test", () => {
    expect(template.toJSON()).toMatchSnapshot();
  });

  // S3 Bucket
  test("S3 Bucket", () => {
    template.hasResourceProperties("AWS::S3::Bucket", {
      PublicAccessBlockConfiguration: {
        BlockPublicAcls: true,
        BlockPublicPolicy: true,
        IgnorePublicAcls: true,
        RestrictPublicBuckets: true,
      },
    });
  });

  // CloudFront Distribution
  test("CloudFront Distribution", () => {
    template.findResources("AWS::CloudFront::Distribution");
  });

  // CloudFront OriginAccessControl
  test("CloudFront OriginAccessControl", () => {
    template.hasResourceProperties("AWS::CloudFront::OriginAccessControl", {
      OriginAccessControlConfig: {
        OriginAccessControlOriginType: "s3",
      },
    });
  });
});
