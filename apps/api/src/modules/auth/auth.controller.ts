import {
  Controller,
  Post,
  Get,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import { SwitchRoleDto } from './dto/switch-role.dto';
import { DemoLoginDto } from './dto/demo-login.dto';
import { Public } from './decorators/public.decorator';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  @ApiOperation({ summary: 'Register a new user' })
  register(@Body() dto: any) {
    return this.authService.register(dto);
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login user' })
  login(@Body() dto: any) {
    return this.authService.login(dto);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh JWT token' })
  refresh(@Body() dto: any) {
    return this.authService.refresh(dto);
  }

  @Public()
  @Post('demo-login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '1-Click persona demo login' })
  demoLogin(@Body() dto: DemoLoginDto) {
    return this.authService.demoLogin(dto.role);
  }

  @Post('switch-role')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Switch active persona role and re-issue scoped JWT token' })
  switchRole(@CurrentUser() user: any, @Body() dto: SwitchRoleDto, @Req() req: any) {
    const userContext = user || req?.user;
    return this.authService.switchRole(userContext, dto.targetRole, dto.organizationId);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user profile and active persona session' })
  getMe(@CurrentUser() user: any, @Req() req: any) {
    const userContext = user || req?.user;
    return this.authService.getMe(userContext);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Logout user' })
  logout() {
    return this.authService.logout();
  }
}
