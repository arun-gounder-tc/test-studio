import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', redirectTo: 'projects', pathMatch: 'full' },
  {
    path: 'projects',
    loadComponent: () => import('./pages/projects/projects.page').then((m) => m.ProjectsPage),
  },
  {
    path: 'library',
    loadComponent: () => import('./pages/library/library.page').then((m) => m.LibraryPage),
  },
  {
    path: 'new',
    loadComponent: () =>
      import('./pages/case-chat/case-chat.page').then((m) => m.CaseChatPage),
  },
  {
    path: 'edit/:testId',
    loadComponent: () => import('./pages/edit/edit.page').then((m) => m.EditPage),
  },
  {
    path: 'run/:testId',
    loadComponent: () => import('./pages/runner/runner.page').then((m) => m.RunnerPage),
  },
  {
    path: 'history',
    loadComponent: () => import('./pages/history/history.page').then((m) => m.HistoryPage),
  },
  { path: '**', redirectTo: 'projects' },
];
