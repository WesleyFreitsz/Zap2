import { Prisma } from "@prisma/client";
import prisma from "../../config/prisma";
import { emitMessageCreated } from "../../realtime";
import { AppError } from "../../utils/AppError";
import { sendImage, sendText } from "../channels/channel-sender";
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
    userId: string,
    role: string,
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
    if (role === "EMPLOYEE" && conversation.assignedToId !== userId) {
      throw new AppError("Access denied to this conversation", 403);
    }

    const imageUrl = product.imageUrl;
    const promoPrice = product.promotionalPrice;
    const displayPrice =
      promoPrice && promoPrice < product.price ? promoPrice : product.price;

    const content =
      customMessage ||
      `📦 *${product.name}*\n${product.description || ""}\n💰 R$ ${displayPrice.toFixed(2)}`;

    const image = imageUrl
      ? await sendImage(conversation, { url: imageUrl, caption: content }).catch(() => {
          // If media fails, fall back to text
          return null;
        })
      : null;
    const { externalId } = image ?? await sendText(conversation, content);

    const [message, updated] = await prisma.$transaction([
      prisma.message.create({
        data: {
          conversationId,
          sender: "USER",
          content,
          externalId,
          mediaType: image ? "image" : null,
          mediaUrl: image ? imageUrl : null,
        },
      }),
      prisma.conversation.update({
        where: { id: conversationId, companyId },
        data: { updatedAt: new Date() },
      }),
    ]);
    emitMessageCreated(updated);

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
      imageUrl: data.imageUrl || null,
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
    if (data.imageUrl !== undefined) mapped.imageUrl = data.imageUrl || null;
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
