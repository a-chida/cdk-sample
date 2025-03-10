import * as cdk from "aws-cdk-lib";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as iam from "aws-cdk-lib/aws-iam";
import * as s3 from "aws-cdk-lib/aws-s3";
import { Construct } from "constructs";

export class StaticWebsiteStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Origin bucket
    const originBucket = new s3.Bucket(this, "OriginBucket", {
      autoDeleteObjects: true,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // CloudFront
    const origin = new origins.S3Origin(originBucket);
    const cfFunction = new cloudfront.Function(this, "Function", {
      functionName: "url-rewrite-spa",
      code: cloudfront.FunctionCode.fromFile({
        filePath: "src/functions/url-rewrite-spa.js",
      }),
    });
    const distribution = new cloudfront.Distribution(this, "Distribution", {
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
      "OriginAccessControl",
      {
        originAccessControlConfig: {
          name: originBucket.bucketRegionalDomainName,
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
      originBucket.bucketRegionalDomainName
    );

    // OAC settings
    cfnDistribution.addOverride(
      "DistributionConfig.Origins.0.OriginAccessControlId",
      cfnOriginAccessControl.getAtt("Id")
    );

    // add S3 bucket policy for CloudFront
    originBucket.addToResourcePolicy(
      new iam.PolicyStatement({
        sid: "AllowCloudFrontServicePrincipalReadOnly",
        effect: iam.Effect.ALLOW,
        principals: [new iam.ServicePrincipal("cloudfront.amazonaws.com")],
        actions: ["s3:GetObject"],
        resources: [originBucket.arnForObjects("*")],
        conditions: {
          StringEquals: {
            "aws:SourceArn": `arn:aws:cloudfront::${this.account}:distribution/${distribution.distributionId}`,
          },
        },
      })
    );
  }
}
