import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideAngularModule, ArrowLeft, Upload, MessageCircle } from 'lucide-angular';

@Component({
  selector: 'studio-upload',
  standalone: true,
  imports: [RouterLink, LucideAngularModule],
  template: `
    <div class="mx-auto max-w-2xl px-6 py-12">
      <div class="rounded-lg border border-zinc-200 bg-white p-8">
        <div class="flex items-start gap-4">
          <span class="inline-flex h-10 w-10 items-center justify-center rounded-md bg-indigo-50 text-indigo-600">
            <i-lucide [img]="Upload" class="h-5 w-5"></i-lucide>
          </span>
          <div>
            <h1 class="text-lg font-semibold text-zinc-900">Bulk upload</h1>
            <p class="mt-1 text-sm text-zinc-500">Coming in a later phase.</p>
          </div>
        </div>
        <p class="mt-5 text-sm text-zinc-700">This page will let you:</p>
        <ul class="mt-2 space-y-1.5 text-sm text-zinc-600">
          <li class="flex items-start gap-2">
            <span class="mt-1 inline-block h-1 w-1 rounded-full bg-zinc-400"></span>
            Upload a CSV or Excel of manual test cases
          </li>
          <li class="flex items-start gap-2">
            <span class="mt-1 inline-block h-1 w-1 rounded-full bg-zinc-400"></span>
            Generate Gherkin tests in batch via Claude / GPT
          </li>
          <li class="flex items-start gap-2">
            <span class="mt-1 inline-block h-1 w-1 rounded-full bg-zinc-400"></span>
            Multi-select and save in one go
          </li>
        </ul>
        <div class="mt-6 flex gap-2">
          <a
            routerLink="/library"
            class="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 focus-ring"
          >
            <i-lucide [img]="ArrowLeft" class="h-3.5 w-3.5"></i-lucide>
            Back to Library
          </a>
          <a
            routerLink="/new"
            class="inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 focus-ring"
          >
            <i-lucide [img]="MessageCircle" class="h-3.5 w-3.5"></i-lucide>
            Chat with AI
          </a>
        </div>
      </div>
    </div>
  `,
})
export class UploadPage {
  readonly ArrowLeft = ArrowLeft;
  readonly Upload = Upload;
  readonly MessageCircle = MessageCircle;
}
