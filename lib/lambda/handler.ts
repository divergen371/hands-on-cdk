import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyStructuredResultV2,
} from "aws-lambda";
import {
  DynamoDBClient,
  PutItemCommand,
  GetItemCommand,
  UpdateItemCommand,
} from "@aws-sdk/client-dynamodb";
import { randomBytes } from "node:crypto";

const client = new DynamoDBClient({});
const TABLE_NAME = process.env.TABLE_NAME || "";
const CLOUDFRONT_DOMAIN = process.env.CLOUDFRONT_DOMAIN || "";

export const handler = async (
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyStructuredResultV2> => {
  try {
    // リクエストパスとメソッドをログに出力（デバッグ用）
    console.log('Request path:', event.rawPath, 'method:', event.requestContext.http.method);

    // POST /url エンドポイント
    if (
      event.requestContext.http.method === "POST" &&
      event.rawPath === "/url"
    ) {
      return await createShortUrl(event);
    }

    // GET /{id} エンドポイント
    if (
      event.requestContext.http.method === "GET" &&
      event.rawPath !== "/url"
    ) {
      return await redirectUrl(event);
    }

    return { statusCode: 400, body: JSON.stringify({ error: "Bad request" }) };
  } catch (e) {
    console.error('Error processing request:', e);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Internal server error" }),
    };
  }
};

async function createShortUrl(
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyStructuredResultV2> {
  // リクエストボディをパース
  const body = JSON.parse(event.body || "{}");
  const longUrl = body.longUrl;

  // 入力バリデーション
  if (!longUrl || typeof longUrl !== "string") {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Missing or invalid longUrl" }),
    };
  }

  if (!longUrl.startsWith("http://") && !longUrl.startsWith("https://")) {
    return {
      statusCode: 400,
      body: JSON.stringify({
        error: "URL must start with http:// or https://",
      }),
    };
  }

  // 短縮URL ID生成 (Base64URLエンコード)
  const id = randomBytes(4).toString("base64url");

  // DynamoDBに保存
  await client.send(
    new PutItemCommand({
      TableName: TABLE_NAME,
      Item: {
        id: { S: id },
        longUrl: { S: longUrl },
        createdAt: { S: new Date().toISOString() },
        hitCount: { N: "0" },
      },
      ConditionExpression: "attribute_not_exists(id)",
    })
  );

  // レスポンス生成（CloudFrontドメインがあればそちらを優先）
  let domain = CLOUDFRONT_DOMAIN;
  if (!domain) {
    domain = event.requestContext.domainName || event.headers.host || "";
  }
  const shortUrl = `https://${domain}/${id}`;

  return {
    statusCode: 201,
    headers: { 
      "Content-Type": "application/json",
      "Cache-Control": "no-cache, no-store, must-revalidate"
    },
    body: JSON.stringify({ shortUrl }),
  };
}

async function redirectUrl(
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyStructuredResultV2> {
  // URLパスからIDを抽出
  const id = event.rawPath.substring(1);

  // DynamoDBからデータ取得
  const response = await client.send(
    new GetItemCommand({
      TableName: TABLE_NAME,
      Key: { id: { S: id } },
    })
  );

  // 見つからない場合は404
  if (!response.Item) {
    return {
      statusCode: 404,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "URL not found" }),
    };
  }

  // ヒットカウントを非同期で更新
  client
    .send(
      new UpdateItemCommand({
        TableName: TABLE_NAME,
        Key: { id: { S: id } },
        UpdateExpression: "ADD hitCount :inc",
        ExpressionAttributeValues: { ":inc": { N: "1" } },
      })
    )
    .catch((err) => console.error("Error updating hit count:", err));

  // 301リダイレクト
  return {
    statusCode: 301,
    headers: {
      Location: response.Item.longUrl.S || "",
      "Cache-Control": "max-age=3600", // 1時間キャッシュ（CloudFront経由の場合）
    },
  };
}
