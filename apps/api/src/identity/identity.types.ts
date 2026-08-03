import type { Request, Response } from 'express';

export interface GraphqlContext {
  req: Request;
  res: Response;
}

export interface SafeViewer {
  id: string;
  email: string;
  role: 'PLAYER' | 'SUPPORT' | 'MODERATOR' | 'ADMIN' | 'ROOT_OWNER';
  createdAt: Date;
}
