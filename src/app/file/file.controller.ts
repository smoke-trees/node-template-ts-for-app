import { Application, Controller, Documentation, Methods } from "@smoke-trees/postgres-backend";
import { Request, RequestHandler, Response } from "express";
import { ParamsDictionary } from "express-serve-static-core";
import multer from "multer";
import { ParsedQs } from "qs";
import { fileUpload } from "./upload";
import { AuthMiddleware } from "../../middleware/authMiddleware";

const upload = multer({ storage: multer.memoryStorage() });
export class FileController extends Controller {
  public path: string = "/file";
  protected controllers: Controller[];
  protected mw: RequestHandler<ParamsDictionary, unknown, unknown, ParsedQs, Record<string, unknown>>[];

  constructor(
    app: Application,
    private readonly authMiddleware: AuthMiddleware
  ) {
    super(app);
    this.controllers = [];
    this.mw = [];
    this.addRoutes({
      path: "/upload",
      method: Methods.POST,
      localMiddleware: [
        upload.single("file"),
        this.authMiddleware.generateAuthMiddleWare({
          opsOnly: true,
        }),
      ],
      handler: this.uploadFile.bind(this),
    });
  }

  @Documentation.addRoute({
    path: "/file/upload",
    method: Methods.POST,
    tags: ["File"],
    responses: {
      "200": {
        description: "Success",
        value: {
          type: "object",
          properties: {
            link: {
              type: "string",
              description: "The link to the file",
            },
            name: {
              type: "string",
              description: "name",
            },
          },
        },
      },
    },
    requestBody: {},
    description: "Upload a file",
    operationId: "uploadFile",
  })
  async uploadFile(req: Request, res: Response) {
    if (req.file === undefined) {
      res.status(400).json({ message: "Missing fields" });
      return;
    }
    const result = await fileUpload(req.file);
    if (result.status.error) {
      res.status(500).json(result);
      return;
    }
    res.status(200).json(result);
  }
}
