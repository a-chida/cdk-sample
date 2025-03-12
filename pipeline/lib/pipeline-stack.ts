import * as cdk from "aws-cdk-lib";
import * as codebuild from "aws-cdk-lib/aws-codebuild";
import * as codecommit from "aws-cdk-lib/aws-codecommit";
import * as codepipeline from "aws-cdk-lib/aws-codepipeline";
import * as codepipeline_actions from "aws-cdk-lib/aws-codepipeline-actions";
import * as events_targets from "aws-cdk-lib/aws-events-targets";
import * as iam from "aws-cdk-lib/aws-iam";
import * as logs from "aws-cdk-lib/aws-logs";
import * as s3 from "aws-cdk-lib/aws-s3";
import { Construct } from "constructs";

export class PipelineStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // create Artifact Bucket and set lifecycle rule
    const artifactBucket = new s3.Bucket(this, "PipelineArtifactBucket", {
      bucketName: "bucket-name",
      // When deleting a stack, empty the bucket before deleting it
      // Note: A Lambda is created as part of the stack that deletes an object,
      // but the CloudWatch Log associated with the Lambda is not deleted.
      autoDeleteObjects: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      lifecycleRules: [
        {
          id: "expire-after-3-days",
          expiration: cdk.Duration.days(3),
        },
      ],
    });

    // CodeCommit Repository
    const repository = codecommit.Repository.fromRepositoryName(
      this,
      "Repository",
      "repository-name"
    );

    // CodeBuild Project
    const project = new codebuild.PipelineProject(this, "MyProject", {
      projectName: "project-name",
      environment: {
        buildImage: codebuild.LinuxBuildImage.AMAZON_LINUX_2_5,
        computeType: codebuild.ComputeType.SMALL,
      },
      logging: {
        cloudWatch: {
          logGroup: new logs.LogGroup(this, "LogGroup", {
            retention: logs.RetentionDays.THREE_DAYS,
            // When deleting a stack, delete the log group
            removalPolicy: cdk.RemovalPolicy.DESTROY,
          }),
        },
      },
    });
    // Add policy to ServiceRole in CodeBuild if necessary
    project.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["s3:*"],
        resources: ["*"],
      })
    );

    // CodePipeline
    const pipeline = new codepipeline.Pipeline(this, "Pipeline", {
      pipelineName: "pipeline-name",
      artifactBucket,
      pipelineType: codepipeline.PipelineType.V2,
    });

    // Add source stage
    const sourceOutput = new codepipeline.Artifact("SourceOutput");
    const sourceAction = new codepipeline_actions.CodeCommitSourceAction({
      actionName: "Source",
      repository,
      output: sourceOutput,
      branch: "main",
      // Add Git tag trigger with PREFIX
      customEventRule: {
        eventPattern: {
          source: ["aws.codecommit"],
          detailType: ["CodeCommit Repository State Change"],
          detail: {
            event: ["referenceCreated", "referenceUpdated"],
            referenceType: ["tag"],
            referenceName: [
              {
                prefix: "v",
              },
            ],
          },
        },
        target: new events_targets.CodePipeline(pipeline),
      },
    });
    pipeline.addStage({
      stageName: "Source",
      actions: [sourceAction],
    });

    // Add build stage
    const buildOutput = new codepipeline.Artifact("BuildOutput");
    const buildAction = new codepipeline_actions.CodeBuildAction({
      actionName: "Build",
      project,
      input: sourceOutput,
      outputs: [buildOutput],
    });
    pipeline.addStage({
      stageName: "Build",
      actions: [buildAction],
    });
  }
}
