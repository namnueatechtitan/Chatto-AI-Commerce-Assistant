import { Module } from "@nestjs/common";
import { CredentialCipherService } from "./credential-cipher.service";
@Module({ providers: [CredentialCipherService], exports: [CredentialCipherService] })
export class CredentialEncryptionModule {}
