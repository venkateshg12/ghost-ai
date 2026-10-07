import { Router } from "express";
import authenticate from "../middleware/authenticate";
import { protectedApiLimiter } from "../config/ratelimiter";
import {
    createProjectHandler,
    deleteProjectHandler,
    getProjectHandler,
    listProjectsHandler,
    renameProjectHandler,
} from "../controllers/project.controller";
import {
    inviteCollaboratorHandler,
    listCollaboratorsHandler,
    removeCollaboratorHandler,
} from "../controllers/collaborator.controller";
import { getCanvasHandler, saveCanvasHandler } from "../controllers/canvas.controller";
import { downloadSpecHandler, getSpecHandler, listSpecsHandler } from "../controllers/spec.controller";

export const projectRoutes = Router();

// prefix : /projects

projectRoutes.use(authenticate, protectedApiLimiter);

projectRoutes.get("/", listProjectsHandler);
projectRoutes.post("/", createProjectHandler);
projectRoutes.get("/:projectId", getProjectHandler);
projectRoutes.patch("/:projectId", renameProjectHandler);
projectRoutes.delete("/:projectId", deleteProjectHandler);

projectRoutes.get("/:projectId/collaborators", listCollaboratorsHandler);
projectRoutes.post("/:projectId/collaborators", inviteCollaboratorHandler);
projectRoutes.delete("/:projectId/collaborators/:email", removeCollaboratorHandler);

projectRoutes.get("/:projectId/canvas", getCanvasHandler);
projectRoutes.put("/:projectId/canvas", saveCanvasHandler);

projectRoutes.get("/:projectId/specs", listSpecsHandler);
projectRoutes.get("/:projectId/specs/:specId", getSpecHandler);
projectRoutes.get("/:projectId/specs/:specId/download", downloadSpecHandler);
