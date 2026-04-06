import crypto from "crypto";
import bcrypt from "bcryptjs";
import prisma from "../../config/prisma";
import { env } from "../../config/env";
import { AppError } from "../../utils/AppError";
import { sendMail } from "../../config/mail";
import { logger } from "../../utils/logger";

function generatePassword(length = 8): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export class InvitationService {
  async sendInvitation(data: {
    email: string;
    role: "ADMIN" | "EMPLOYEE";
    companyId?: string | null;
    invitedById: string;
    companyName?: string;
    isTeamLeader?: boolean;
  }) {
    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: data.email },
    });
    if (existingUser) {
      throw new AppError("A user with this email already exists", 409);
    }

    // Check for existing pending invitation
    const existingInvite = await prisma.invitation.findFirst({
      where: {
        email: data.email,
        status: "PENDING",
        expiresAt: { gt: new Date() },
      },
    });
    if (existingInvite) {
      throw new AppError(
        "An active invitation already exists for this email",
        409,
      );
    }

    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    // If SUPER_ADMIN is inviting an ADMIN, create the company first
    let companyId = data.companyId;
    if (data.role === "ADMIN" && !companyId && data.companyName) {
      const company = await prisma.company.create({
        data: {
          name: data.companyName,
          plan: "basic",
          isActive: true,
        },
      });
      companyId = company.id;
    }

    const isTeamLeader =
      data.role === "EMPLOYEE" ? data.isTeamLeader || false : false;

    if (companyId) {
      await this.ensureEmployeeLimit(companyId);
      if (isTeamLeader) {
        await this.ensureTeamLeaderLimit(companyId);
      }
    }

    // Generate provisional password and create user immediately
    const provisionalPassword = generatePassword();
    const hashedPassword = await bcrypt.hash(provisionalPassword, 12);

    const user = await prisma.user.create({
      data: {
        name: data.email.split("@")[0],
        email: data.email,
        password: hashedPassword,
        role: data.role as any,
        companyId: companyId || null,
        isTeamLeader,
        mustChangePassword: true,
      },
    });

    const invitation = await prisma.invitation.create({
      data: {
        email: data.email,
        role: data.role,
        companyId: companyId || null,
        invitedById: data.invitedById,
        token,
        expiresAt,
        status: "ACCEPTED",
      },
      include: {
        company: { select: { id: true, name: true } },
      },
    });

    // Send email with provisional password
    const loginUrl = `${env.FRONTEND_URL}/login`;
    const roleName = data.role === "ADMIN" ? "Administrador" : "Funcionário";

    try {
      await sendMail(
        data.email,
        `Bem-vindo à plataforma - Suas credenciais de acesso`,
        `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #333;">Bem-vindo à plataforma!</h2>
          <p>Você foi convidado como <strong>${roleName}</strong>${invitation.company ? ` na empresa <strong>${invitation.company.name}</strong>` : ""}.</p>
          <p>Sua conta já foi criada. Use as credenciais abaixo para fazer login:</p>
          <div style="background: #f4f4f5; border-radius: 8px; padding: 16px; margin: 16px 0;">
            <p style="margin: 4px 0;"><strong>Email:</strong> ${data.email}</p>
            <p style="margin: 4px 0;"><strong>Senha provisória:</strong> <code style="background: #e4e4e7; padding: 2px 6px; border-radius: 4px; font-size: 16px;">${provisionalPassword}</code></p>
          </div>
          <p style="color: #dc2626; font-weight: 600;">⚠️ Troque sua senha no primeiro acesso em Configurações.</p>
          <a href="${loginUrl}" style="display: inline-block; background: #6366f1; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; margin: 16px 0;">
            Acessar Plataforma
          </a>
          <p style="color: #999; font-size: 12px;">Se você não esperava este email, pode ignorá-lo.</p>
        </div>
        `,
      );
      logger.info(`[Invitation] Credentials sent to ${data.email}`);
    } catch (err) {
      logger.error(
        `[Invitation] Failed to send email to ${data.email}: ${(err as Error).message}`,
      );
    }

    return {
      invitation,
      user: { id: user.id, email: user.email, role: user.role },
    };
  }

  async listByCompany(companyId: string) {
    return prisma.invitation.findMany({
      where: { companyId },
      orderBy: { createdAt: "desc" },
      include: {
        invitedBy: { select: { id: true, name: true } },
      },
    });
  }

  async listAll() {
    return prisma.invitation.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        company: { select: { id: true, name: true } },
        invitedBy: { select: { id: true, name: true } },
      },
    });
  }

  async revoke(id: string, companyId?: string | null) {
    const where: any = { id };
    if (companyId) where.companyId = companyId;

    const invitation = await prisma.invitation.findFirst({ where });
    if (!invitation) throw new AppError("Invitation not found", 404);

    // Also delete the user created for this invitation
    const user = await prisma.user.findUnique({
      where: { email: invitation.email },
    });
    if (user) {
      await prisma.user.delete({ where: { id: user.id } });
    }

    await prisma.invitation.delete({ where: { id } });
    return { message: "Invitation revoked and user removed" };
  }

  async getByToken(token: string) {
    const invitation = await prisma.invitation.findUnique({
      where: { token },
      include: { company: { select: { id: true, name: true } } },
    });

    if (!invitation) throw new AppError("Invalid invitation token", 404);

    return {
      email: invitation.email,
      role: invitation.role,
      company: invitation.company,
      status: invitation.status,
      expiresAt: invitation.expiresAt,
      expired: invitation.expiresAt < new Date(),
    };
  }

  private async getActivePlan(companyId: string) {
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { plan: true },
    });

    if (!company) {
      throw new AppError("Company not found", 404);
    }

    return (prisma as any).plan.findFirst({
      where: { slug: company.plan, isActive: true },
    });
  }

  private async ensureEmployeeLimit(companyId: string) {
    const plan = await this.getActivePlan(companyId);
    if (!plan) return;

    const currentUsers = await prisma.user.count({ where: { companyId } });
    if (currentUsers >= plan.maxEmployees) {
      throw new AppError(
        `Limite do plano atingido: máximo de ${plan.maxEmployees} funcionário(s) no plano ${plan.name}`,
        403,
      );
    }
  }

  private async ensureTeamLeaderLimit(companyId: string) {
    const plan = await this.getActivePlan(companyId);
    if (!plan) return;

    if (plan.maxTeamLeaders <= 0) {
      throw new AppError(
        `O plano ${plan.name} não permite líderes de equipe. Faça upgrade para liberar esse recurso.`,
        403,
      );
    }

    const currentTeamLeaders = await prisma.user.count({
      where: { companyId, role: "EMPLOYEE", isTeamLeader: true },
    });

    if (currentTeamLeaders >= plan.maxTeamLeaders) {
      throw new AppError(
        `Limite do plano atingido: máximo de ${plan.maxTeamLeaders} líder(es) de equipe no plano ${plan.name}`,
        403,
      );
    }
  }
}
