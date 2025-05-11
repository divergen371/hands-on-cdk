import type { Construct } from "constructs";
import * as cdk from "aws-cdk-lib";
import { aws_ec2 as ec2 } from "aws-cdk-lib";
import { aws_ecs as ecs } from "aws-cdk-lib";
import { aws_ecs_patterns as ecs_patterns } from "aws-cdk-lib";

export class FargateServiceStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const vpc = new ec2.Vpc(this, "HandsOnCdkVpc", {
      ipAddresses: ec2.IpAddresses.cidr("192.168.0.0/24"),
    });

    const cluster = new ecs.Cluster(this, "HandsOnCdkCluster", { vpc });

    const taskDefinition = new ecs.FargateTaskDefinition(
      this,
      "HandsOnCdkTaskDef"
    );
    const conteiner = taskDefinition.addContainer("HandsOnAppContainer", {
      image: ecs.ContainerImage.fromRegistry("nginx"),
    });

    conteiner.addPortMappings({ containerPort: 80 });

    new ecs_patterns.ApplicationLoadBalancedFargateService(
      this,
      "HandsOnCdkFargateService",
      {
        cluster,
        taskDefinition,
        publicLoadBalancer: true,
      }
    );
  }
}
