import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user.decorator';
import { TenantUser } from '../auth/auth.types';
import { RequirePermission } from '../auth/permissions.decorator';
import { PermissionsGuard } from '../auth/permissions.guard';
import { TenantGuard } from '../auth/tenant.guard';
import {
  AddCertificationDto,
  AddDocumentDto,
  AddImageDto,
  CreateProductDto,
  ListProductsQueryDto,
  UpdateProductDto,
} from './dto/product.dto';
import { ProductsService } from './products.service';
import { ProductImagesService } from './product-images.service';
import { ProductCertificationsService } from './product-certifications.service';
import { ProductDocumentsService } from './product-documents.service';

@ApiTags('products')
@ApiBearerAuth('jwt')
@UseGuards(AuthGuard('jwt'), TenantGuard, PermissionsGuard)
@Controller('products')
export class ProductsController {
  constructor(
    private readonly productsService: ProductsService,
    private readonly productImagesService: ProductImagesService,
    private readonly productCertificationsService: ProductCertificationsService,
    private readonly productDocumentsService: ProductDocumentsService,
  ) {}

  @Get()
  @RequirePermission('products.read')
  list(@CurrentUser() user: TenantUser, @Query() query: ListProductsQueryDto) {
    return this.productsService.list(user.organisationId, query);
  }

  @Get(':id')
  @RequirePermission('products.read')
  findOne(@CurrentUser() user: TenantUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.productsService.findOne(user.organisationId, id);
  }

  @Get(':id/publish-blockers')
  @RequirePermission('products.read')
  getPublishBlockers(@CurrentUser() user: TenantUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.productsService.getPublishBlockers(user.organisationId, id);
  }

  @Post()
  @RequirePermission('products.create')
  create(@CurrentUser() user: TenantUser, @Body() dto: CreateProductDto) {
    return this.productsService.create(user.organisationId, dto, user.id);
  }

  @Patch(':id')
  @RequirePermission('products.update')
  update(@CurrentUser() user: TenantUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateProductDto) {
    return this.productsService.update(user.organisationId, id, dto, user.id);
  }

  @Delete(':id')
  @RequirePermission('products.delete')
  remove(@CurrentUser() user: TenantUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.productsService.softDelete(user.organisationId, id, user.id);
  }

  @Post(':id/images')
  @RequirePermission('products.update')
  async addImage(@CurrentUser() user: TenantUser, @Param('id', ParseUUIDPipe) id: string, @Body() body: AddImageDto) {
    return this.productImagesService.addImage(user.organisationId, id, body, user.id);
  }

  @Patch(':id/images/:imageId/cover')
  @RequirePermission('products.update')
  async setCoverImage(
    @CurrentUser() user: TenantUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('imageId', ParseUUIDPipe) imageId: string,
  ) {
    return this.productImagesService.setCoverImage(user.organisationId, id, imageId, user.id);
  }

  @Delete(':id/images/:imageId')
  @RequirePermission('products.update')
  async removeImage(
    @CurrentUser() user: TenantUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('imageId', ParseUUIDPipe) imageId: string,
  ) {
    return this.productImagesService.removeImage(user.organisationId, id, imageId, user.id);
  }

  @Post(':id/certifications')
  @RequirePermission('products.update')
  async addCertification(
    @CurrentUser() user: TenantUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: AddCertificationDto,
  ) {
    return this.productCertificationsService.addCertification(user.organisationId, id, body, user.id);
  }

  @Delete(':id/certifications/:certificationId')
  @RequirePermission('products.update')
  async removeCertification(
    @CurrentUser() user: TenantUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('certificationId', ParseUUIDPipe) certificationId: string,
  ) {
    return this.productCertificationsService.removeCertification(user.organisationId, id, certificationId, user.id);
  }

  @Post(':id/documents')
  @RequirePermission('products.update')
  async addDocument(@CurrentUser() user: TenantUser, @Param('id', ParseUUIDPipe) id: string, @Body() body: AddDocumentDto) {
    return this.productDocumentsService.addDocument(user.organisationId, id, body, user.id);
  }

  @Delete(':id/documents/:documentId')
  @RequirePermission('products.update')
  async removeDocument(
    @CurrentUser() user: TenantUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('documentId', ParseUUIDPipe) documentId: string,
  ) {
    return this.productDocumentsService.removeDocument(user.organisationId, id, documentId, user.id);
  }
}
