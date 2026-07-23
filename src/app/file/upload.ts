import { ErrorCode, IResult, log } from "@smoke-trees/postgres-backend";
import crypto from "crypto";
import settings from "../../settings";
import { IFile } from "./IFile";
import aws from "aws-sdk";

if (settings.awsAccessKey && settings.awsSecretKey) {
  aws.config.update({
    secretAccessKey: settings.awsSecretKey,
    accessKeyId: settings.awsAccessKey,
    region: settings.awsRegion,
  });
}

if (settings.awsProfileName) {
  const profile = new aws.SharedIniFileCredentials({
    profile: settings.awsProfileName,
  });
  aws.config.update({
    region: settings.awsRegion,
    credentials: profile,
  });
}

const s3 = new aws.S3();

export const fileUpload = async (file: Express.Multer.File, folder?: string): Promise<IResult<IFile | undefined>> => {
  const filename = file.originalname;
  const ext = filename.split(".");
  const hash = crypto.createHash("sha256").update(file.buffer);
  try {
    const hashname = `${hash.digest("hex")}.${ext[ext.length - 1]}`;
    await s3
      .putObject({
        Bucket: `${settings.s3Bucket}/${folder ?? settings.s3Folder}`,
        Body: file.buffer,
        Key: hashname,
        ACL: "public-read",
        ContentType: file.mimetype,
      })
      .promise();
    return {
      status: {
        code: ErrorCode.Success,
        error: false,
      },
      result: { link: `https://${settings.s3Bucket}.s3.${settings.awsRegion}.amazonaws.com/${folder ?? settings.s3Folder}/${hashname}`, name: filename },
      message: "File uploaded successfully",
    };
  } catch (e) {
    log.error("Error uploading image", `imageUpload/${filename}`, e);
    return {
      status: {
        code: ErrorCode.InternalServerError,
        error: true,
      },
      result: undefined,
      message: "File upload failed on Bucket",
    };
  }
};
