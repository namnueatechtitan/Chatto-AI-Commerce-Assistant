# Phase 2 Overview

## Phase 2 Goal

Build the development foundation for merchant onboarding, dashboard access, merchant knowledge management, LINE message intake, MCP-based mock AI replies, conversation storage, and human handover scaffolding.

## Phase 2.1 Foundation

- Monorepo workspace setup
- NestJS API scaffold
- Next.js dashboard scaffold
- AI service scaffold
- Prisma schema for Phase 2
- Shared package and config package setup

## Phase 2.2 LINE Integration

- Channel management scaffold hardens into real channel setup
- LINE webhook receiver moves from placeholder to verified input handling
- Webhook event persistence becomes integration-ready

## Phase 2.3 AI Integration

- API to AI service gateway
- MCP manifest, resources, tools, and chat endpoint for the mock AI pipeline
- Prompt manager and intent pipeline activation
- Mock AI replies evolve into real service orchestration
- LINE text messages call the MCP AI service and send AI replies through LINE OA
- AI requests include merchant settings, product data, knowledge base data, and vector document rows from the database
- AI replies are stored as `messages.sender_type = ai`

## Phase 2.4 Knowledge Integration

- Product APIs and FAQ APIs become working merchant tools
- Context builder consumes merchant product and knowledge records
- Vector and embedding placeholders prepare retrieval support

## Phase 2.5 Conversation System

- Conversation history APIs and UI
- Customer memory structure ready for later summarization
- Message threading supports later replay and review flows

## Phase 2.6 Human Handover

- Ticket, message, and assignment flows
- Agent visibility into escalated cases
- AI-triggered handover path scaffold

## Phase 2.7 Integration Test + Bug Fix

- End-to-end sanity checks
- Bug fixes across API, web, AI service, and schema
- Docs updates and demo preparation
