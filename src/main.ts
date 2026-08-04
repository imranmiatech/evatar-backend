import { NestFactory, Reflector } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { ValidationException } from './common/exceptions';
import { LanguageService } from './modules/language/language.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Global prefix
  app.setGlobalPrefix('api/v1');

  // CORS configuration
  app.enableCors({
    origin: true,
    credentials: true,
  });

  // Cookie parser
  app.use(cookieParser());

  // Global filters
  app.useGlobalFilters(new GlobalExceptionFilter());

  // Global interceptors
  const reflector = app.get(Reflector);
  const languageService = app.get(LanguageService);
  app.useGlobalInterceptors(new ResponseInterceptor(reflector, languageService));

  // Global pipes
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
      exceptionFactory: (errors) => {
        const validationErrors = errors.map((error) => ({
          field: error.property,
          message: Object.values(error.constraints ?? {})[0] ?? 'Invalid value',
          value: error.value,
        }));
        return new ValidationException(validationErrors);
      },
    }),
  );


  const config = new DocumentBuilder()
    .setTitle('EvaTurner API')
    .setDescription('The backend API for EvaTurner application')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true
    }
  });

  const expressApp = app.getHttpAdapter().getInstance();
  
  expressApp.get(['/admin-user-management.html', '/api/v1/admin/users/ui', '/admin-users-ui'], (req: any, res: any) => {
    res.sendFile(require('path').join(process.cwd(), 'admin-user-management.html'));
  });

  await app.listen(process.env.PORT ?? 5000);
}
bootstrap();
