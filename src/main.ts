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
  const app = await NestFactory.create(AppModule, { rawBody: true });

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
  
  expressApp.get('/admin-dashboard', (req: any, res: any) => {
    const fs = require('fs');
    const path = require('path');
    const possiblePaths = [
      path.resolve(process.cwd(), 'public/admin-users.html'),
      path.resolve(__dirname, '../public/admin-users.html'),
      path.resolve(__dirname, '../../public/admin-users.html'),
    ];
    const targetPath = possiblePaths.find(p => fs.existsSync(p)) || possiblePaths[0];
    res.sendFile(targetPath);
  });

  expressApp.get('/notifications-ui', (req: any, res: any) => {
    const fs = require('fs');
    const path = require('path');
    const possiblePaths = [
      path.resolve(process.cwd(), 'public/mobile-notifications.html'),
      path.resolve(__dirname, '../public/mobile-notifications.html'),
      path.resolve(__dirname, '../../public/mobile-notifications.html'),
    ];
    const targetPath = possiblePaths.find(p => fs.existsSync(p)) || possiblePaths[0];
    res.sendFile(targetPath);
  });

  expressApp.get('/messages-ui', (req: any, res: any) => {
    const fs = require('fs');
    const path = require('path');
    const possiblePaths = [
      path.resolve(process.cwd(), 'public/mobile-messages.html'),
      path.resolve(__dirname, '../public/mobile-messages.html'),
      path.resolve(__dirname, '../../public/mobile-messages.html'),
    ];
    const targetPath = possiblePaths.find(p => fs.existsSync(p)) || possiblePaths[0];
    res.sendFile(targetPath);
  });

  expressApp.get(['/login', '/login-ui', '/login-token'], (req: any, res: any) => {
    const fs = require('fs');
    const path = require('path');
    const possiblePaths = [
      path.resolve(process.cwd(), 'public/login.html'),
      path.resolve(process.cwd(), 'public/login-token.html'),
      path.resolve(__dirname, '../public/login.html'),
      path.resolve(__dirname, '../public/login-token.html'),
    ];
    const targetPath = possiblePaths.find(p => fs.existsSync(p)) || possiblePaths[0];
    res.sendFile(targetPath);
  });

  expressApp.get('/caregiver-ui', (req: any, res: any) => {
    const fs = require('fs');
    const path = require('path');
    const possiblePaths = [
      path.resolve(process.cwd(), 'public/caregiver-mobile.html'),
      path.resolve(__dirname, '../public/caregiver-mobile.html'),
      path.resolve(__dirname, '../../public/caregiver-mobile.html'),
    ];
    const targetPath = possiblePaths.find(p => fs.existsSync(p)) || possiblePaths[0];
    res.sendFile(targetPath);
  });

  expressApp.get('/care-ui', (req: any, res: any) => {
    const fs = require('fs');
    const path = require('path');
    const possiblePaths = [
      path.resolve(process.cwd(), 'public/mobile-care.html'),
      path.resolve(__dirname, '../public/mobile-care.html'),
      path.resolve(__dirname, '../../public/mobile-care.html'),
    ];
    const targetPath = possiblePaths.find(p => fs.existsSync(p)) || possiblePaths[0];
    res.sendFile(targetPath);
  });

  expressApp.get(['/meal-ui', '/recipes-ui', '/meal'], (req: any, res: any) => {
    const fs = require('fs');
    const path = require('path');
    const possiblePaths = [
      path.resolve(process.cwd(), 'public/mobile-meal.html'),
      path.resolve(__dirname, '../public/mobile-meal.html'),
      path.resolve(__dirname, '../../public/mobile-meal.html'),
    ];
    const targetPath = possiblePaths.find(p => fs.existsSync(p)) || possiblePaths[0];
    res.sendFile(targetPath);
  });

  expressApp.get('/', (req: any, res: any) => {
    res.redirect('/admin-dashboard');
  });

 

  await app.listen(process.env.PORT ?? 5000);
}
bootstrap();
