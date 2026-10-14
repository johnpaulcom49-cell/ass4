# TaskForge

TaskForge is a task management dashboard built with HTML, Tailwind CSS and plain JavaScript. Everything on the page is created, updated and removed through the DOM, and all data is saved in `localStorage`, so tasks are still there after a refresh or after closing the browser.

## Project files

| File | Purpose |
| --- | --- |
| `index.html` | Page structure: header, statistics, filters, bulk bar, task list, modals and the task card `<template>`. Loads Tailwind CSS from its CDN. |
| `style.css` | A few small rules Tailwind does not cover (smooth scrolling, reduced motion, keyboard focus on the task body). All other styling is Tailwind utility classes. |
| `app.js` | All application logic. |
| `README.md` | This document. |

## Tailwind CSS

All of the styling is done with Tailwind utility classes loaded from the Tailwind CDN (`<script src="https://cdn.tailwindcss.com/3.4.17">`). Dark mode is switched on in the Tailwind config with `darkMode: 'class'`, so the `dark:` utilities work whenever the `dark` class is on the `<html>` element.

- **In `index.html`**: layout, spacing, colors, buttons, form fields, modals and the card template are all written with utilities such as `grid`, `gap-3`, `rounded-xl`, `bg-white` and `dark:bg-slate-900`.
- **In `app.js`**: the task states are applied by adding and removing Tailwind classes with `classList`. The groups are stored in objects such as `CARD_STATE_STYLES`, `CARD_PRIORITY_STYLES`, `BADGE_PRIORITY_STYLES` and `BADGE_STATUS_STYLES`, and the helpers `addClasses()`, `removeClasses()` and `removeGroup()` loop through them. For example, an overdue card gets `bg-red-50 border-red-200`, a completed card gets `opacity-70` and `line-through` on its title, and a critical card gets `border-l-red-600`.
- The readable names (`is-completed`, `is-overdue`, `priority-high` and so on) are still added to each element as hooks, so the state is easy to see in the browser inspector.

## How to run

1. Put the four files in one folder.
2. Open `index.html` in a browser (an internet connection is needed for the Tailwind CDN and the Google Fonts).
3. On the first visit, 12 sample tasks are created automatically.

## Features

- Add, edit, delete, complete and un-complete tasks
- Form validation with errors shown under each field
- Search by title, description or category, with a 300 ms debounce
- Status, priority and category filters that work together with the search
- Eight sorting options (plus "My custom order" for drag and drop)
- Statistics for total, completed, pending and overdue tasks
- Checkboxes, Select All, bulk delete, bulk complete, bulk pending and a selected counter
- Task details modal with close, edit and delete options
- Overdue detection with a different look
- Empty state and "No tasks found" message
- Keyboard shortcuts: `N` new task, `/` focus search, `Esc` close modal, `Ctrl + Enter` submit the form
- Dark mode, saved in `localStorage`
- Unsaved changes warning when editing
- Sample data on first launch

Bonus features: drag and drop with saved order, pagination (10 per page), debounced search, undo delete and JSON import and export.

## Task management logic

Each task is a plain object:

```js
{
  id: 'task-1712345678901-4821',
  title: 'Fix login API bug',
  description: 'Users get a 500 error when the token expires.',
  category: 'Backend',
  priority: 'critical',
  dueDate: '2025-01-20',
  createdAt: '2025-01-15T09:30:00.000Z',
  completed: false
}
```

All tasks live in one array called `tasks`. The array is the single source of truth. The page is never edited piece by piece. Instead, every change follows the same three steps:

1. Change the `tasks` array (`addTask`, `updateTask`, `toggleTask`, `deleteTasks`).
2. Save it with `saveTasks()`.
3. Call `render()`, which rebuilds the statistics, the task list, the pagination and the bulk bar from the array.

Because the statistics are recalculated inside `render()`, they update automatically whenever the data changes.

### Filtering, searching and sorting

`getVisibleTasks()` runs `getFilteredTasks()` and then `sortTasks()`.

- `getFilteredTasks()` loops over every task and skips it if it fails any check: search text, status, priority or category. A task is only kept when it passes all of them, which is why the filters work together.
- `sortTasks()` uses an insertion sort with `compareTasks()`, which returns a negative number, zero or a positive number depending on the sort mode.
- `render()` then shows only the 10 tasks that belong to the current page.

### Status rules

- **Completed**: `completed` is `true`.
- **Overdue**: not completed and the due date is before today (`isOverdue()`).
- **Pending**: not completed. Overdue tasks are also pending, so the Pending filter and statistic include them and Overdue is a subset of Pending.

The status is used to add and remove CSS classes on each card: `is-completed`, `is-pending`, `is-overdue`, and `priority-low`, `priority-medium`, `priority-high`, `priority-critical`. This is done in `applyStateClasses()` and `applyBadgeClasses()` using `classList.add()`, `classList.remove()` and `classList.toggle()`.

### Form validation

`readForm()` collects the values with `FormData`. `validateForm()` returns an object with one message per invalid field. `showErrors()` writes the messages under the fields, adds the `field-invalid` class and sets `aria-invalid`. If there are no errors, the task is added or updated, saved, the form is reset and the modal closes. `event.preventDefault()` stops the page from refreshing.

### Editing and unsaved changes

When Edit is clicked, `openEditForm()` fills the form and stores the task id on the form with `setAttribute('data-editing-id', id)`. It also saves a snapshot of the starting values. When the user tries to close the form, `hasUnsavedChanges()` compares the current values with the snapshot. If something changed, a confirmation modal asks whether to discard the changes. On submit, `getAttribute('data-editing-id')` decides whether to update an existing task or create a new one, and `removeAttribute()` clears it afterwards.

### Delete and undo

Deleting always goes through the confirmation modal (`showConfirm()`). `deleteTasks()` remembers the removed tasks and their positions in `lastDeleted`, and a toast with an **Undo** button appears for 8 seconds. `restoreDeleted()` puts the tasks back in their original positions.

### Selection and bulk actions

Selected task ids are stored in the `selectedIds` array. Select All selects every task that matches the current filters. The selection is cleared when the search or filters change, so bulk actions only affect tasks the user can see.

### Drag and drop

Cards are `draggable`. While dragging, the dragged card is moved in the DOM with `insertBefore()`, using `previousElementSibling` and `nextElementSibling` to avoid unnecessary moves. When the drag ends, the new order is read from `taskList.children`, written back into the `tasks` array by `applyNewOrder()`, saved, and the sort option switches to "My custom order".

### Import and export

Export creates a JSON `Blob`, a temporary download link and clicks it. Import reads the chosen file with `FileReader`, parses it with `JSON.parse()` inside `try...catch`, checks every task with `isValidImportedTask()` and adds the valid tasks that are not already in the list.

## Event delegation

Task cards are created and destroyed constantly, so buttons are not given their own listeners. Instead, one listener sits on the parent `#task-list` and works out what was clicked:

```js
taskList.addEventListener('click', function (event) {
  const trigger = event.target.closest('[data-action]');
  if (!trigger) {
    return;
  }
  const card = trigger.closest('.task-card');
  const id = card.dataset.id;
  const action = trigger.dataset.action;
  ...
});
```

1. `event.target` is the exact element that was clicked.
2. `closest('[data-action]')` walks up the tree to the button (or card body) that carries a `data-action` value such as `toggle`, `edit`, `delete` or `details`.
3. `closest('.task-card')` walks up to the card, and `card.dataset.id` gives the task id.
4. An `if / else if` chain runs the matching function.

The same idea is used for:

| Parent | What it handles |
| --- | --- |
| `#task-list` (`change`) | Task checkboxes |
| `#task-list` (`dragstart`, `dragover`, `dragend`) | Drag and drop |
| `#pagination` | Page buttons with `data-page` |
| `#toast-container` | The Undo button |
| `#details-modal` | Edit and Delete buttons inside the details modal |
| `document` | Every `data-close` button and clicks on the modal backdrop |

`event.currentTarget` is used in the filter dropdowns: all four share one kind of listener and read `event.currentTarget.dataset.filter` to know which filter changed.

## `data-*` attributes

- Every card has `data-id`, `data-status`, `data-priority`, `data-category` and `data-due`, set with `card.dataset`.
- Buttons use `data-action` (`toggle`, `edit`, `delete`, `details`, `undo`, `edit-from-details`, `delete-from-details`).
- Filter dropdowns use `data-filter`, pagination buttons use `data-page`, and close buttons use `data-close`.
- Validation messages use `data-error-for`, which is read with `dataset.errorFor`.
- The form stores the id of the task being edited in `data-editing-id`, and the details modal stores the open task id in `dataset.id`.

## localStorage

| Key | Value |
| --- | --- |
| `taskforge_tasks` | The whole `tasks` array as a JSON string |
| `taskforge_theme` | `'dark'` or `'light'` |

- `saveTasks()` runs `localStorage.setItem('taskforge_tasks', JSON.stringify(tasks))` after every change.
- `loadTasks()` runs when the app starts. It reads the key with `getItem()` and converts it back with `JSON.parse()` inside `try...catch`, so corrupted data cannot crash the page.
- If the key does not exist (first visit), `buildSampleTasks()` creates 12 sample tasks with different categories, priorities, due dates and statuses, and saves them.
- If the key exists but holds an empty list, the app shows the empty state and does **not** recreate the samples.
- The theme is saved when the toggle is clicked and applied again by `init()`.

## DOM methods used

| Method or property | Where it is used |
| --- | --- |
| `getElementById()` | Collecting references at the top of `app.js`, `updateEmptyState()`, `openDetails()` |
| `querySelector()` | `buildCard()` to find the title, description and badges inside a card; `showErrors()` to find the input that belongs to an error message |
| `querySelectorAll()` | `renderStats()` for the stat cards, `showErrors()`, the `[data-filter]` controls, `showToast()` for old Undo buttons |
| `createElement()` | `showToast()`, `updateEmptyState()`, `exportTasks()` |
| `append()` | `renderList()` adds each card to the fragment; `showToast()` adds the message and Undo button to the toast |
| `appendChild()` | `renderList()` adds the fragment to the list; `exportTasks()` adds the download link to the body |
| `prepend()` | `showToast()` puts the newest toast on top |
| `remove()` | Removing the download link and old toasts |
| `removeChild()` | The toast removes itself with `toast.parentElement.removeChild(toast)` after its timer ends |
| `replaceWith()` | `updateEmptyState()` swaps the old empty-state element for a new one |
| `cloneNode(true)` | `buildCard()` clones the card inside the `<template>` for every task |
| `insertAdjacentHTML()` | `renderPagination()` adds the Previous, number and Next buttons |
| `textContent` | Filling in task text safely (titles, descriptions, dates, badges, counters, error messages) |
| `innerHTML` | Clearing the list and pagination (`= ''`) and building the static empty-state messages |
| `classList` (`add`, `remove`, `toggle`, `contains`) | State, priority and selection classes; showing and hiding modals and errors; dark mode |
| `setAttribute()` | `aria-hidden` on modals, `aria-invalid`, `aria-pressed`, `aria-label` on checkboxes, `data-editing-id` |
| `getAttribute()` | Reading `data-editing-id` on submit |
| `removeAttribute()` | Clearing `data-editing-id` and `aria-invalid` |
| `dataset` | Reading and writing task ids and other `data-*` values |
| `parentElement` | `showErrors()` and the form `input` handler find the error message next to a field; toasts remove themselves |
| `children` | `dragend` reads the new card order from `taskList.children` |
| `firstElementChild` | `buildCard()` gets the row inside the cloned card; the template content's first element |
| `lastElementChild` | `buildCard()` gets the actions area; `renderStats()` writes the number into each stat card |
| `nextElementSibling` | `buildCard()` goes from the checkbox to the task body; `dragover` decides where to drop a card |
| `previousElementSibling` | `dragover` decides where to drop a card |
| `closest()` | Finding the card, button, modal or toast that an event came from |
| `addEventListener()` | All user interaction |
| `preventDefault()` | Form submit, `N` and `/` shortcuts, `Ctrl + Enter`, `dragover` |
| `event.target` / `event.currentTarget` | Event delegation and the shared filter listener |
| `FormData` | `readForm()` |
| `createDocumentFragment()` | `renderList()` builds all cards off-screen and adds them in one step |
| `localStorage` | Saving tasks and the theme |
| `JSON.stringify()` / `JSON.parse()` | Saving, loading, exporting and importing tasks |

## Keyboard shortcuts

| Key | Action |
| --- | --- |
| `N` | Open the new task form |
| `/` | Focus the search box |
| `Esc` | Close the top open modal (the unsaved-changes check still applies to the edit form) |
| `Ctrl + Enter` | Submit the task form |

`N` and `/` are ignored while typing in a field or while a modal is open.

## Screenshots

Add screenshots of the finished app to a `screenshots/` folder and list them here, for example:

- Dashboard in light mode
- Dashboard in dark mode
- Add and edit task form with validation errors
- Delete confirmation modal
- Task details modal
- Filters and search with results
- "No tasks found" state