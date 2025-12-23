# Supabase Setup Instructions

## 1. Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign up/login
2. Click "New Project"
3. Choose your organization and enter project details
4. Wait for the project to be created

## 2. Get Your Project Credentials

1. In your Supabase dashboard, go to Settings > API
2. Copy your Project URL and anon/public key

## 3. Configure Environment Variables

Create a `.env.local` file in your project root with:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

Replace the values with your actual Supabase credentials.

## 4. Database Schema

The dashboard expects the following tables in your Supabase database:

### Users Table
```sql
CREATE TABLE users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  username TEXT,
  email TEXT,
  balance DECIMAL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Transactions Table
```sql
CREATE TABLE transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  type TEXT CHECK (type IN ('deposit', 'withdraw')),
  currency TEXT CHECK (currency IN ('SOL', 'OGX')),
  amount DECIMAL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Spins Table
```sql
CREATE TABLE spins (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  reward TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Tickets Table
```sql
CREATE TABLE tickets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  price DECIMAL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## 5. Sample Data (Optional)

You can add some sample data to test the dashboard:

```sql
-- Insert sample users
INSERT INTO users (username, email, balance) VALUES
('john_doe', 'john@example.com', 100.50),
('jane_smith', 'jane@example.com', 250.75),
('bob_wilson', 'bob@example.com', 75.25);

-- Insert sample transactions
INSERT INTO transactions (user_id, type, currency, amount) VALUES
((SELECT id FROM users WHERE username = 'john_doe'), 'deposit', 'SOL', 50.00),
((SELECT id FROM users WHERE username = 'jane_smith'), 'deposit', 'OGX', 100.00),
((SELECT id FROM users WHERE username = 'bob_wilson'), 'withdraw', 'SOL', 25.00);

-- Insert sample spins
INSERT INTO spins (user_id, reward) VALUES
((SELECT id FROM users WHERE username = 'john_doe'), '10 SOL'),
((SELECT id FROM users WHERE username = 'jane_smith'), '5 OGX'),
((SELECT id FROM users WHERE username = 'bob_wilson'), 'Nothing');

-- Insert sample tickets
INSERT INTO tickets (user_id, price) VALUES
((SELECT id FROM users WHERE username = 'john_doe'), 10.00),
((SELECT id FROM users WHERE username = 'jane_smith'), 15.00),
((SELECT id FROM users WHERE username = 'bob_wilson'), 5.00);
```

## 6. Row Level Security (RLS)

Enable RLS on your tables for security:

```sql
-- Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE spins ENABLE ROW LEVEL SECURITY;
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;

-- Create policies (adjust based on your needs)
CREATE POLICY "Allow all operations for authenticated users" ON users FOR ALL USING (true);
CREATE POLICY "Allow all operations for authenticated users" ON transactions FOR ALL USING (true);
CREATE POLICY "Allow all operations for authenticated users" ON spins FOR ALL USING (true);
CREATE POLICY "Allow all operations for authenticated users" ON tickets FOR ALL USING (true);
```

## 7. Start the Development Server

```bash
npm run dev
```

Your dashboard should now display real data from your Supabase database!

## Troubleshooting

- Make sure your environment variables are correctly set
- Check that your Supabase project is active
- Verify that the database tables exist and have the correct schema
- Check the browser console for any error messages
