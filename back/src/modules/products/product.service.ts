import { Prisma } from "@prisma/client";
import prisma from "../../config/prisma";
import { AppError } from "../../utils/AppError";
import { CreateProductInput, UpdateProductInput } from "./product.schema";

export class ProductService {
  async create(data: CreateProductInput, companyId: string) {
    return prisma.product.create({
      data: this.mapCreateProductData(data, companyId),
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

    return prisma.product.update({
      where: { id },
      data: this.mapUpdateProductData(data),
    });
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

    const imageUrl = product.imageUrl || product.image;
    const promoPrice = product.promotionalPrice;
    const displayPrice =
      promoPrice && promoPrice < product.price ? promoPrice : product.price;

    const content =
      customMessage ||
      `📦 *${product.name}*\n${product.description || ""}\n💰 R$ ${displayPrice.toFixed(2)}`;

    const { wppConnectService } =
      await import("../integrations/wppconnect/wppconnect.service");
    const destination =
      conversation.contactRemoteId || conversation.contactPhone;

    if (imageUrl && destination) {
      try {
        await wppConnectService.sendMediaAuto(companyId, {
          number: destination,
          type: "image",
          url: imageUrl,
          caption: content,
        });
      } catch {
        // If media fails, fall back to text
        await wppConnectService.sendMessageAuto(
          companyId,
          destination,
          content,
        );
      }
    } else if (destination) {
      await wppConnectService.sendMessageAuto(companyId, destination, content);
    }

    const message = await prisma.message.create({
      data: {
        conversationId,
        sender: "USER",
        content,
      },
    });

    await prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });

    return message;
  }

  private mapCreateProductData(
    data: CreateProductInput,
    companyId: string,
  ): Prisma.ProductUncheckedCreateInput {
    return {
      name: data.name,
      code: data.code || null,
      description: data.description || null,
      price: data.price,
      image: data.image || null,
      imageUrl: data.imageUrl || data.image || null,
      category: data.category || null,
      promotionalPrice: data.promotionalPrice ?? null,
      stock: data.stock ?? 0,
      active: data.active ?? true,
      whatsappMessage: data.whatsappMessage || null,
      companyId,
    };
  }

  private mapUpdateProductData(
    data: UpdateProductInput,
  ): Prisma.ProductUncheckedUpdateInput {
    const mapped: Prisma.ProductUncheckedUpdateInput = {};

    if (data.name !== undefined) mapped.name = data.name;
    if (data.code !== undefined) mapped.code = data.code || null;
    if (data.description !== undefined)
      mapped.description = data.description || null;
    if (data.price !== undefined) mapped.price = data.price;
    if (data.image !== undefined) mapped.image = data.image || null;
    if (data.imageUrl !== undefined)
      mapped.imageUrl = data.imageUrl || data.image || null;
    else if (data.image !== undefined) {
      mapped.imageUrl = data.image || null;
    }
    if (data.category !== undefined) mapped.category = data.category || null;
    if (data.promotionalPrice !== undefined)
      mapped.promotionalPrice = data.promotionalPrice ?? null;
    if (data.stock !== undefined) mapped.stock = data.stock;
    if (data.active !== undefined) mapped.active = data.active;
    if (data.whatsappMessage !== undefined)
      mapped.whatsappMessage = data.whatsappMessage || null;

    return mapped;
  }
}
