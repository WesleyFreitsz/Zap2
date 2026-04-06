import prisma from "../../config/prisma";
import { AppError } from "../../utils/AppError";
import { CreateProductInput, UpdateProductInput } from "./product.schema";

export class ProductService {
  async create(data: CreateProductInput, companyId: string) {
    return prisma.product.create({
      data: { ...data, companyId },
    });
  }

  async findAll(companyId: string) {
    return prisma.product.findMany({
      where: { companyId },
      orderBy: { createdAt: "desc" },
    });
  }

  async findById(id: string, companyId: string) {
    const product = await prisma.product.findFirst({
      where: { id, companyId },
    });
    if (!product) throw new AppError("Product not found", 404);
    return product;
  }

  async update(id: string, companyId: string, data: UpdateProductInput) {
    const product = await prisma.product.findFirst({
      where: { id, companyId },
    });
    if (!product) throw new AppError("Product not found", 404);

    return prisma.product.update({ where: { id }, data });
  }

  async delete(id: string, companyId: string) {
    const product = await prisma.product.findFirst({
      where: { id, companyId },
    });
    if (!product) throw new AppError("Product not found", 404);

    await prisma.product.delete({ where: { id } });
    return { message: "Product deleted successfully" };
  }

  async sendToChat(
    productId: string,
    conversationId: string,
    companyId: string,
    customMessage?: string,
  ) {
    const product = await prisma.product.findFirst({
      where: { id: productId, companyId },
    });
    if (!product) throw new AppError("Product not found", 404);

    const conversation = await prisma.conversation.findFirst({
      where: { id: conversationId, companyId },
    });
    if (!conversation) throw new AppError("Conversation not found", 404);

    const imageUrl = (product as any).imageUrl || product.image;
    const promoPrice = (product as any).promotionalPrice;
    const displayPrice =
      promoPrice && promoPrice < product.price ? promoPrice : product.price;

    const content =
      customMessage ||
      `📦 *${product.name}*\n${product.description || ""}\n💰 R$ ${displayPrice.toFixed(2)}`;

    const { EvolutionService } =
      await import("../integrations/evolution/evolution.service");
    const evolutionService = new EvolutionService();

    // Send product image via WhatsApp if available
    if (imageUrl && conversation.contactPhone) {
      try {
        await evolutionService.sendMedia(companyId, {
          number: conversation.contactPhone,
          type: "image",
          url: imageUrl,
          caption: content,
        });
      } catch {
        // If media fails, fall back to text
        await evolutionService.sendMessage(
          companyId,
          conversation.contactPhone,
          content,
        );
      }
    } else if (conversation.contactPhone) {
      await evolutionService.sendMessage(
        companyId,
        conversation.contactPhone,
        content,
      );
    }

    const message = await prisma.message.create({
      data: {
        conversationId,
        sender: "USER",
        content,
      },
    });

    return message;
  }
}
