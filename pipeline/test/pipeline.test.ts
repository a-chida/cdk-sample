import * as cdk from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import * as CdkPipeline from "../lib/pipeline-stack";

describe("Pipeline", () => {
  const app = new cdk.App();
  const stack = new CdkPipeline.PipelineStack(app, "CdkPipelineStack");
  const template = Template.fromStack(stack);

  // Snapshot test
  test("snapshot test", () => {
    expect(template.toJSON()).toMatchSnapshot();
  });

  // Verify S3 lifecycle rules
  test("S3 Bucket with Lifecycle Policy", () => {
    template.hasResourceProperties("AWS::S3::Bucket", {
      BucketName: "bucket-name",
      LifecycleConfiguration: {
        Rules: [{ Status: "Enabled", ExpirationInDays: 3 }],
      },
    });
  });

  // Verify CodeBuild project
  test("CodeBuild project", () => {
    template.hasResourceProperties("AWS::CodeBuild::Project", {
      Name: "project-name",
      Environment: {
        ComputeType: "BUILD_GENERAL1_SMALL",
        Image: "aws/codebuild/amazonlinux2-x86_64-standard:5.0",
        Type: "LINUX_CONTAINER",
      },
    });
  });

  // Verify log retention period specified by CodeBuild
  test("CodeBuild project log retention is set to 3 days", () => {
    template.hasResourceProperties("AWS::Logs::LogGroup", {
      RetentionInDays: 3,
    });
  });

  // Verify CodePipeline trigger
  test("Pipeline has a trigger", () => {
    template.hasResourceProperties("AWS::Events::Rule", {
      EventPattern: {
        source: ["aws.codecommit"],
        "detail-type": ["CodeCommit Repository State Change"],
        detail: {
          event: ["referenceCreated", "referenceUpdated"],
          referenceType: ["tag"],
          referenceName: [{ prefix: "v" }],
        },
      },
    });
  });

  // Exists source stage and build stage in Pipeline
  test("Pipeline has Source and Build stages", () => {
    template.hasResourceProperties("AWS::CodePipeline::Pipeline", {
      Name: "pipeline-name",
      Stages: [
        {
          Name: "Source",
          Actions: [
            {
              ActionTypeId: {
                Category: "Source",
                Provider: "CodeCommit",
              },
              Configuration: {
                BranchName: "main",
                RepositoryName: "repository-name",
              },
            },
          ],
        },
        {
          Name: "Build",
          Actions: [
            {
              ActionTypeId: {
                Category: "Build",
                Provider: "CodeBuild",
              },
            },
          ],
        },
      ],
    });
  });
});
