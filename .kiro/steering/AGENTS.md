---
inclusion: manual
---

# AI Agent Instructions

## 1. Project Overview

This is a strict TypeScript project. Ensure all code modifications adhere strictly to the conventions and boundaries defined below.

## 2. Workflows & Validation

- **Pre-completion Check:** Before completing any task or reporting success to the user, you MUST run `npm run build` in the terminal.
- Do not consider a task finished if the build command returns errors. Fix the errors first.

## 3. Coding Conventions

- **TypeScript Typing:** Strict typing is enforced. You are strictly forbidden from using the `any` type.
- Always define and apply the exact, correct types and interfaces for all variables, function parameters, and return values. Expend the necessary effort to infer or look up the correct types.

## 4. Behavioral Boundaries

- **File Management:** DO NOT create any new Markdown (`.md`) files within this repository unless the user explicitly and directly instructs you to do so.
- Keep the workspace clean and do not auto-generate documentation updates on your own initiative.

# 5. Used technologies

- **Agent Building Framework:** When asked to build an agent, use the Strands Agents library with TypeScript.
- **Model for building agents:** Agents should use Claude Haiku 4.5 from Amazon Bedrock.
