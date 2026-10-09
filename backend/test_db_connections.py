#!/usr/bin/env python3

import asyncio
import os
import sys
from dotenv import load_dotenv

load_dotenv()

GREEN = '\033[92m'
RED = '\033[91m'
YELLOW = '\033[93m'
BLUE = '\033[94m'
RESET = '\033[0m'


async def test_postgres_connection():
    print(f"\n{BLUE}Testing PostgreSQL (Supabase)...{RESET}")
    try:
        import asyncpg
        
        url = os.getenv('DATABASE_URL')
        if not url:
            print(f"{RED}✗ DATABASE_URL not set{RESET}")
            return False
        
        conn = await asyncpg.connect(url)
        result = await conn.fetchval('SELECT 1')
        await conn.close()
        
        if result == 1:
            print(f"{GREEN}✓ PostgreSQL connection successful{RESET}")
            print(f"  Host: {os.getenv('POSTGRES_HOST')}")
            print(f"  Database: {os.getenv('POSTGRES_DB')}")
            return True
        else:
            print(f"{RED}✗ PostgreSQL connection failed{RESET}")
            return False
            
    except Exception as e:
        print(f"{RED}✗ PostgreSQL connection error: {str(e)}{RESET}")
        return False


async def test_mongodb_connection():
    print(f"\n{BLUE}Testing MongoDB (Atlas)...{RESET}")
    try:
        from motor.motor_asyncio import AsyncIOMotorClient as AsyncClient
        
        uri = os.getenv('MONGODB_URI')
        if not uri:
            print(f"{RED}✗ MONGODB_URI not set{RESET}")
            return False
        
        client = AsyncClient(uri, serverSelectionTimeoutMS=5000)
        
        await client.admin.command('ping')
        
        db = client[os.getenv('MONGODB_DB', 'technova')]
        collections = await db.list_collection_names()
        
        client.close()
        
        print(f"{GREEN}✓ MongoDB connection successful{RESET}")
        print(f"  Database: {os.getenv('MONGODB_DB')}")
        print(f"  Collections: {len(collections)} found")
        return True
        
    except Exception as e:
        print(f"{RED}✗ MongoDB connection error: {str(e)}{RESET}")
        return False


async def test_redis_connection():
    print(f"\n{BLUE}Testing Redis...{RESET}")
    try:
        import redis.asyncio as redis
        
        url = os.getenv('REDIS_URL')
        if not url:
            print(f"{RED}✗ REDIS_URL not set{RESET}")
            return False
        
        client = redis.from_url(url, decode_responses=True)
        
        pong = await client.ping()
        
        await client.set('test_key', 'test_value')
        value = await client.get('test_key')
        await client.delete('test_key')
        
        await client.close()
        
        if value == 'test_value':
            print(f"{GREEN}✓ Redis connection successful{RESET}")
            print(f"  Host: {os.getenv('REDIS_HOST')}")
            print(f"  Port: {os.getenv('REDIS_PORT')}")
            return True
        else:
            print(f"{RED}✗ Redis connection failed (set/get mismatch){RESET}")
            return False
            
    except Exception as e:
        print(f"{RED}✗ Redis connection error: {str(e)}{RESET}")
        return False


async def main():
    print(f"\n{BLUE}{'='*60}")
    print(f"TECHNOVA Database Connection Test")
    print(f"{'='*60}{RESET}\n")
    
    print(f"{YELLOW}Environment: {os.getenv('ENVIRONMENT', 'development')}{RESET}")
    print(f"{YELLOW}Debug: {os.getenv('DEBUG', 'False')}{RESET}")
    
    results = {}
    
    results['PostgreSQL'] = await test_postgres_connection()
    
    results['MongoDB'] = await test_mongodb_connection()
    
    results['Redis'] = await test_redis_connection()
    
    print(f"\n{BLUE}{'='*60}")
    print(f"Connection Test Summary")
    print(f"{'='*60}{RESET}\n")
    
    for db_name, success in results.items():
        status = f"{GREEN}✓ CONNECTED{RESET}" if success else f"{RED}✗ FAILED{RESET}"
        print(f"  {db_name:<15} {status}")
    
    all_passed = all(results.values())
    
    print(f"\n{BLUE}{'='*60}{RESET}")
    if all_passed:
        print(f"{GREEN}All database connections successful!{RESET}")
        print(f"Your backend is ready to run.{RESET}\n")
        return 0
    else:
        failed_count = sum(1 for v in results.values() if not v)
        print(f"{RED}{failed_count}/{len(results)} database(s) failed to connect{RESET}")
        print(f"Check your .env configuration and credentials.{RESET}\n")
        return 1


if __name__ == '__main__':
    exit_code = asyncio.run(main())
    sys.exit(exit_code)
