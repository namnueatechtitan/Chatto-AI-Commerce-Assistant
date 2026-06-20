import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class LatestMessageDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  customerName!: string;

  @ApiPropertyOptional()
  customerAvatar?: string;

  @ApiProperty()
  message!: string;

  @ApiProperty({
    description: "ISO 8601 timestamp",
    example: "2026-06-20T11:41:13.000Z",
  })
  timestamp!: string;

  @ApiProperty()
  unread!: boolean;

  @ApiProperty({
    enum: ["LINE"],
    example: "LINE",
  })
  channel!: "LINE";
}
