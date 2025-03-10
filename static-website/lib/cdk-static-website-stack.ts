import * as cdk from "aws-cdk-lib";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as iam from "aws-cdk-lib/aws-iam";
import * as s3 from "aws-cdk-lib/aws-s3";
import { Construct } from "constructs";

const PREFIX = "cdk-static-website";

export class CdkStaticWebsiteStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // S3 bucket
    const s3Bucket = new s3.Bucket(this, "S3Bucket", {
      autoDeleteObjects: true,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      bucketName: `${PREFIX}-origin`,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // CloudFront
    const origin = new origins.S3Origin(s3Bucket);
    const cfFunction = new cloudfront.Function(this, "Function", {
      functionName: `${PREFIX}-url-rewrite-spa`,
      code: cloudfront.FunctionCode.fromFile({
        filePath: "cloudfront-function/url-rewrite-spa.js",
      }),
    });
    const distribution = new cloudfront.Distribution(this, "distribution", {
      defaultBehavior: {
        origin: origin,
        functionAssociations: [
          {
            eventType: cloudfront.FunctionEventType.VIEWER_REQUEST,
            function: cfFunction,
          },
        ],
      },
      defaultRootObject: "index.html",
      geoRestriction: cloudfront.GeoRestriction.allowlist("JP"),
      httpVersion: cloudfront.HttpVersion.HTTP2_AND_3,
      minimumProtocolVersion: cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021,
      priceClass: cloudfront.PriceClass.PRICE_CLASS_200,
    });

    // Use L1 constructor to implement OAC because L2 constructor is not support Origin Access Control
    // Ref: https://github.com/aws/aws-cdk/issues/21771
    const cfnOriginAccessControl = new cloudfront.CfnOriginAccessControl(
      this,
      "cf-origin-access-control",
      {
        originAccessControlConfig: {
          name: s3Bucket.bucketRegionalDomainName,
          originAccessControlOriginType: "s3",
          signingBehavior: "always",
          signingProtocol: "sigv4",
          description: "S3 Access Control",
        },
      }
    );

    // Additional settings for origin 0 (0: s3Bucket)
    const cfnDistribution = distribution.node
      .defaultChild as cloudfront.CfnDistribution;
    // Delete OAI
    cfnDistribution.addOverride(
      "Properties.DistributionConfig.Origins.0.S3OriginConfig.OriginAccessIdentity",
      ""
    );
    // OAC does not require CustomOriginConfig
    cfnDistribution.addPropertyDeletionOverride(
      "DistributionConfig.Origins.0.CustomOriginConfig"
    );
    // By default, the s3 WebsiteURL is set and an error occurs, so set the S3 domain name
    cfnDistribution.addPropertyOverride(
      "DistributionConfig.Origins.0.DomainName",
      s3Bucket.bucketRegionalDomainName
    );

    // OAC settings
    cfnDistribution.addOverride(
      "DistributionConfig.Origins.0.OriginAccessControlId",
      cfnOriginAccessControl.getAtt("Id")
    );

    // add S3 bucket policy for CloudFront
    s3Bucket.addToResourcePolicy(
      new iam.PolicyStatement({
        sid: "AllowCloudFrontServicePrincipalReadOnly",
        effect: iam.Effect.ALLOW,
        principals: [new iam.ServicePrincipal("cloudfront.amazonaws.com")],
        actions: ["s3:GetObject"],
        resources: [s3Bucket.arnForObjects("*")],
        conditions: {
          StringEquals: {
            "aws:SourceArn": `arn:aws:cloudfront::${this.account}:distribution/${distribution.distributionId}`,
          },
        },
      })
    );
  }
}
