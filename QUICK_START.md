# Quick Start Guide

## 🚀 Running the Application

### 1. Start the Development Server

```bash
npm run dev
```

The application will be available at: **http://localhost:3000**

### 2. Create Your First Super Admin Account

Before you can login, you need to create a super admin user:

```bash
node scripts/create-super-admin.mjs
```

This script will ask you for:
- Email address
- Password (minimum 8 characters)
- Full name
- Company/Tenant name

### 3. Login

1. Open your browser and go to: **http://localhost:3000/auth/login**
2. Enter the email and password you created
3. You'll be redirected to the dashboard

## 📋 Default Routes

- **/** - Dashboard (requires login)
- **/auth/login** - Login page
- **/voyages** - Voyages management
- **/claims** - Claims management
- **/data** - Data management (lookup fields)
- **/admin/customers** - Super Admin: Customer management
- **/customer-admin/users** - Customer Admin: User management

## 🔐 User Roles

- **super_admin** - Full access, can manage customers
- **customer_admin** - Can manage company users and access all features
- **operator** - Can only view and manage company data

## 🛠️ Troubleshooting

### "Cannot connect to Supabase"
- Check your `.env.local` file has the correct credentials
- Verify your Supabase project is active

### "No tenant context available"
- Make sure you've created a user with a tenant
- Run the `create-super-admin.mjs` script

### Port 3000 already in use
- Stop other applications using port 3000
- Or change the port: `npm run dev -- -p 3001`

## 📝 Next Steps

After logging in:
1. Explore the Dashboard
2. Create your first Voyage
3. Create a Claim linked to the Voyage
4. Set up lookup data (vessels, ports, etc.)

