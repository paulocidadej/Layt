# Laytime and Demurrage Platform

This is a SaaS platform for laytime and demurrage calculation and management.

## Progress

- Project initialized with Next.js and TypeScript.
- Basic page structure created for Voyages, Claims, and Data.
- `shadcn-ui` has been set up for the component library.

## To-Do

- **Setup & Configuration**
  - [ ] Resolve `autoprefixer` dependency issue.
  - [ ] Set up a database (SQLite with Prisma).
  - [ ] Implement user management and authentication.
  - [ ] Create an admin panel for superuser.
  - [ ] Create a customer admin panel.

- **Design & UI**
  - [ ] Implement a modern, maritime-themed design with a blue-to-green gradient.
  - [ ] Improve the overall layout and user experience.

- **Voyages Screen**
  - [ ] Create a table to display voyages with filtering and pagination.
  - [ ] Implement the "Create Voyage" dialog.
  - [ ] Implement "Edit" and "Delete" functionality for voyages.
  - [ ] Link voyage creation to the database.

- **Claims Screen**
  - [ ] Create a table to display claims.
  - [ ] Implement the "Create Claim" dialog.
  - [ ] Link claim creation to a voyage.

- **Calculation Screen**
  - [ ] Design and implement the interactive calculation sheet.
  - [ ] Implement the logic for laytime and demurrage calculation.
  - [ ] Add functionality to export calculations as a PDF.

- **Data Screen**
  - [ ] Implement functionality to manage data for dropdown fields (e.g., vessel names, charter parties).

## Running the Application

Once the dependencies are installed, you can run the development server with:

```bash
npm run dev
```