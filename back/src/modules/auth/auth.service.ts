import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import prisma from "../../config/prisma";
import { env } from "../../config/env";
import { AppError } from "../../utils/AppError";
import { RegisterInput, LoginInput } from "./auth.schema";

export class AuthService {
  // Legacy register — kept for SUPER_ADMIN bootstrap only
  async register(data: RegisterInput) {
    const existingUser = await prisma.user.findUnique({
      where: { email: data.email },
    });
    if (existingUser) {
      throw new AppError("Email already registered", 409);
    }

    const hashedPassword = await bcrypt.hash(data.password, 12);

    const company = await prisma.company.create({
      data: {
        name: data.companyName,
        plan: "basic",
        isActive: true,
      },
    });

    const user = await prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        password: hashedPassword,
        role: "ADMIN",
        companyId: company.id,
      },
    });

    const tokens = this.generateTokens(
      user.id,
      user.email,
      user.role,
      company.id,
    );

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      company: { id: company.id, name: company.name },
      ...tokens,
    };
  }

  async login(data: LoginInput) {
    const user = await prisma.user.findUnique({
      where: { email: data.email },
      include: { company: true },
    });

    if (!user) {
      throw new AppError("Invalid credentials", 401);
    }

    const isPasswordValid = await bcrypt.compare(data.password, user.password);
    if (!isPasswordValid) {
      throw new AppError("Invalid credentials", 401);
    }

    if (user.company && !user.company.isActive) {
      throw new AppError("Company subscription is inactive", 403);
    }

    const tokens = this.generateTokens(
      user.id,
      user.email,
      user.role,
      user.companyId,
    );

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        isTeamLeader: (user as any).isTeamLeader || false,
        mustChangePassword: (user as any).mustChangePassword || false,
        companyId: user.companyId,
      },
      ...tokens,
    };
  }

  async refreshToken(token: string) {
    try {
      const decoded = jwt.verify(token, env.JWT_REFRESH_SECRET) as {
        userId: string;
        email: string;
        role: string;
        companyId: string | null;
      };

      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
      });
      if (!user) {
        throw new AppError("User not found", 404);
      }

      return this.generateTokens(
        user.id,
        user.email,
        user.role,
        user.companyId,
      );
    } catch {
      throw new AppError("Invalid refresh token", 401);
    }
  }

  private generateTokens(
    userId: string,
    email: string,
    role: string,
    companyId: string | null,
  ) {
    const payload = { userId, email, role, companyId };

    const accessToken = jwt.sign(payload, env.JWT_SECRET, {
      expiresIn: env.JWT_EXPIRES_IN,
    } as jwt.SignOptions);

    const refreshToken = jwt.sign(payload, env.JWT_REFRESH_SECRET, {
      expiresIn: env.JWT_REFRESH_EXPIRES_IN,
    } as jwt.SignOptions);

    return { accessToken, refreshToken };
  }
}
