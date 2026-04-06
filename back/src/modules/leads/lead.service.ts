import prisma from "../../config/prisma";
import { AppError } from "../../utils/AppError";
import { CreateLeadInput, UpdateLeadInput } from "./lead.schema";
import { normalizePhone } from "../integrations/evolution/evolution.service";

export class LeadService {
  async create(data: CreateLeadInput, companyId: string) {
    // Remove formatação e normaliza
    let phone = data.phone.replace(/\D/g, "");

    // Se não começar com 55, adiciona (Brasil)
    if (!phone.startsWith("55") && phone.length <= 11) {
      phone = `55${phone}`;
    }

    console.log("🔍 [LEAD] Verificando telefone:", {
      original: data.phone,
      normalized: phone,
      companyId
    });

    const existing = await prisma.lead.findUnique({
      where: { phone_companyId: { phone, companyId } },
    });

    if (existing) {
      console.log("❌ [LEAD] Telefone já existe:", existing.phone);
      throw new AppError("Lead with this phone already exists", 409);
    }

    // Create lead
    const lead = await prisma.lead.create({
      data: {
        name: data.name,
        phone,
        email: data.email,
        temperature: data.temperature,
        status: data.status,
        notes: data.notes,
        companyId,
        assignedToId: data.assignedToId,
      },
      include: {
        assignedTo: { select: { id: true, name: true } },
      },
    });

    console.log("✅ [LEAD] Lead criado:", { id: lead.id, phone: lead.phone });

    return lead;
  }

  async findAll(
    companyId: string,
    filters: {
      temperature?: string;
      status?: string;
      assignedToId?: string;
      search?: string;
    } = {},
    userRole?: string,
    userId?: string,
  ) {
    console.log("🔍 [LEAD] Buscando leads:", { companyId, filters, userRole });

    const where: any = { companyId };

    if (filters.temperature) where.temperature = filters.temperature;
    if (filters.status) where.status = filters.status;
    if (filters.assignedToId) where.assignedToId = filters.assignedToId;

    // EMPLOYEE only sees their own leads
    if (userRole === "EMPLOYEE" && userId) {
      where.assignedToId = userId;
    }

    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search, mode: "insensitive" } },
        { phone: { contains: filters.search } },
        { email: { contains: filters.search, mode: "insensitive" } },
      ];
    }

    const leads = await prisma.lead.findMany({
      where,
      include: {
        assignedTo: { select: { id: true, name: true } },
        _count: { select: { conversations: true } },
      },
      orderBy: { updatedAt: "desc" },
    });

    // Buscar tags para cada lead
    const leadsWithTags = await Promise.all(
      leads.map(async (lead) => {
        const tags = await prisma.$queryRaw`
          SELECT t.* FROM tags t
          INNER JOIN lead_tags lt ON t.id = lt."tagId"
          WHERE lt."leadId" = ${lead.id}
        `;
        return { ...lead, tags };
      })
    );

    console.log("📋 [LEAD] Leads encontrados:", leadsWithTags.length);
    leadsWithTags.forEach(lead => {
      console.log(`  - ${lead.name}: ${lead.phone}`);
    });

    return leadsWithTags;
  }

  async findById(id: string, companyId: string) {
    const lead = await prisma.lead.findFirst({
      where: { id, companyId },
      include: {
        assignedTo: { select: { id: true, name: true } },
        conversations: {
          orderBy: { updatedAt: "desc" },
          take: 5,
          select: { id: true, status: true, updatedAt: true },
        },
      },
    });
    if (!lead) throw new AppError("Lead not found", 404);
    return lead;
  }

  async update(id: string, companyId: string, data: UpdateLeadInput) {
    const lead = await prisma.lead.findFirst({ where: { id, companyId } });
    if (!lead) throw new AppError("Lead not found", 404);

    const updateData: any = { ...data };
    if (data.phone) {
      // Remove formatação e normaliza
      let phone = data.phone.replace(/\D/g, "");
      if (!phone.startsWith("55") && phone.length <= 11) {
        phone = `55${phone}`;
      }
      updateData.phone = phone;
    }

    // Processar tags se enviadas
    if (data.tags && Array.isArray(data.tags)) {
      try {
        // Remover todas as tags existentes usando SQL bruto
        await prisma.$executeRaw`DELETE FROM lead_tags WHERE "leadId" = ${id}`;

        // Adicionar as novas tags usando SQL bruto
        if (data.tags.length > 0) {
          for (const tagId of data.tags) {
            await prisma.$executeRaw`INSERT INTO lead_tags ("leadId", "tagId") VALUES (${id}, ${tagId})`;
          }
        }

        console.log("✅ [LEAD] Tags atualizadas:", data.tags);
      } catch (error) {
        console.error("❌ [LEAD] Erro ao salvar tags:", error);
        throw new AppError("Failed to update lead tags", 500);
      }
    }

    console.log("📝 [LEAD] Atualizando lead:", { id, updateData });

    return prisma.lead.update({
      where: { id },
      data: updateData,
      include: {
        assignedTo: { select: { id: true, name: true } },
      },
    });
  }

  async delete(id: string, companyId: string) {
    const lead = await prisma.lead.findFirst({ where: { id, companyId } });
    if (!lead) throw new AppError("Lead not found", 404);

    await prisma.lead.delete({ where: { id } });
    return { message: "Lead deleted successfully" };
  }

  async findOrCreateByPhone(
    phone: string,
    companyId: string,
    name?: string,
  ) {
    // Remove formatação e normaliza
    let normalized = phone.replace(/\D/g, "");
    if (!normalized.startsWith("55") && normalized.length <= 11) {
      normalized = `55${normalized}`;
    }

    console.log("🔍 [LEAD] Buscando lead por telefone:", { original: phone, normalized, companyId });

    let lead = await prisma.lead.findUnique({
      where: { phone_companyId: { phone: normalized, companyId } },
    });

    if (!lead) {
      lead = await prisma.lead.create({
        data: {
          name: name || normalized,
          phone: normalized,
          companyId,
          temperature: "COLD",
          status: "NEW",
        },
      });
      console.log("✅ [LEAD] Lead criado via findOrCreate:", { id: lead.id, phone: lead.phone });
    } else {
      console.log("📋 [LEAD] Lead encontrado:", { id: lead.id, phone: lead.phone });
    }

    return lead;
  }
}
